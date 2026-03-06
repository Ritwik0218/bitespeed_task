import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

interface ContactResponse {
  primaryContatctId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

/**
 * Get all contacts in a cluster starting from a primary contact
 */
async function getContactCluster(primaryId: number): Promise<number[]> {
  const result: number[] = [primaryId];
  const visited = new Set<number>([primaryId]);

  async function traverse(contactId: number) {
    // Get all secondary contacts linked to this contact
    const secondaries = await prisma.contact.findMany({
      where: {
        linkedId: contactId,
        deletedAt: null,
      },
    });

    for (const secondary of secondaries) {
      if (!visited.has(secondary.id)) {
        visited.add(secondary.id);
        result.push(secondary.id);
        await traverse(secondary.id);
      }
    }
  }

  await traverse(primaryId);
  return result;
}

/**
 * Find the primary contact for a given contact (traverse up the chain)
 */
async function getPrimaryContact(contactId: number): Promise<number> {
  let current = contactId;
  let visited = new Set<number>();

  while (true) {
    if (visited.has(current)) {
      // Circular reference detected
      break;
    }
    visited.add(current);

    const contact = await prisma.contact.findUnique({
      where: { id: current },
    });

    if (!contact || contact.linkPrecedence === 'primary' || contact.linkedId === null) {
      return contact ? current : contactId;
    }

    current = contact.linkedId;
  }

  return current;
}

/**
 * Build the response for a contact cluster
 */
async function buildResponse(primaryId: number): Promise<ContactResponse> {
  const clusterIds = await getContactCluster(primaryId);

  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: clusterIds },
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  const primaryContact = contacts.find((c) => c.id === primaryId);
  const secondaryContacts = contacts.filter((c) => c.id !== primaryId);

  // Collect emails and phone numbers
  const emailsSet = new Set<string>();
  const phoneNumbersSet = new Set<string>();

  // Add primary contact's email and phone first
  if (primaryContact?.email) emailsSet.add(primaryContact.email);
  if (primaryContact?.phoneNumber) phoneNumbersSet.add(primaryContact.phoneNumber);

  // Add secondary contacts' emails and phone numbers
  for (const contact of secondaryContacts) {
    if (contact.email) emailsSet.add(contact.email);
    if (contact.phoneNumber) phoneNumbersSet.add(contact.phoneNumber);
  }

  return {
    primaryContatctId: primaryId,
    emails: Array.from(emailsSet),
    phoneNumbers: Array.from(phoneNumbersSet),
    secondaryContactIds: secondaryContacts.map((c) => c.id),
  };
}

/**
 * Main identify function
 */
export async function identify(request: IdentifyRequest): Promise<ContactResponse> {
  const { email, phoneNumber } = request;

  if (!email && !phoneNumber) {
    throw new Error('Either email or phoneNumber must be provided');
  }

  // Find existing contacts matching email or phone
  const existingContacts = await prisma.contact.findMany({
    where: {
      OR: [
        email ? { email } : { id: -1 }, // -1 ensures this condition is never true if email is undefined
        phoneNumber ? { phoneNumber } : { id: -1 },
      ],
      deletedAt: null,
    },
  });

  // Case 1: No match found - create new primary contact
  if (existingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkPrecedence: 'primary',
      },
    });

    return buildResponse(newContact.id);
  }

  // Find primary contacts from existing contacts
  const primaryIds = new Set<number>();
  const primaryContactMap = new Map<number, typeof existingContacts[0]>();

  for (const contact of existingContacts) {
    const primaryId = await getPrimaryContact(contact.id);
    primaryIds.add(primaryId);
    if (!primaryContactMap.has(primaryId)) {
      const primaryContact = await prisma.contact.findUnique({
        where: { id: primaryId },
      });
      if (primaryContact) {
        primaryContactMap.set(primaryId, primaryContact);
      }
    }
  }

  // Case 2: All matches belong to the same cluster
  if (primaryIds.size === 1) {
    const primaryId = Array.from(primaryIds)[0];

    // Check if we need to add new info as secondary contact
    const primaryContact = primaryContactMap.get(primaryId)!;
    const hasEmail = primaryContact.email === email;
    const hasPhone = primaryContact.phoneNumber === phoneNumber;

    // If new information is provided, add it to the primary contact
    if (!hasEmail || !hasPhone) {
      // Case 3: Partial match - create secondary contact if both fields don't match the primary
      if (email && phoneNumber && !hasEmail && !hasPhone) {
        // Check if both email and phone already exist in the cluster
        const clusterIds = await getContactCluster(primaryId);
        const clusterContacts = await prisma.contact.findMany({
          where: { id: { in: clusterIds }, deletedAt: null },
        });

        const emailExists = clusterContacts.some((c) => c.email === email);
        const phoneExists = clusterContacts.some((c) => c.phoneNumber === phoneNumber);

        if (!emailExists || !phoneExists) {
          await prisma.contact.create({
            data: {
              email: email || null,
              phoneNumber: phoneNumber || null,
              linkedId: primaryId,
              linkPrecedence: 'secondary',
            },
          });
        }
      } else if (email && !hasEmail) {
        // Email is new but phone matches
        const clusterIds = await getContactCluster(primaryId);
        const clusterContacts = await prisma.contact.findMany({
          where: { id: { in: clusterIds }, deletedAt: null },
        });

        const emailExists = clusterContacts.some((c) => c.email === email);
        if (!emailExists) {
          await prisma.contact.create({
            data: {
              email,
              phoneNumber: null,
              linkedId: primaryId,
              linkPrecedence: 'secondary',
            },
          });
        }
      } else if (phoneNumber && !hasPhone) {
        // Phone is new but email matches
        const clusterIds = await getContactCluster(primaryId);
        const clusterContacts = await prisma.contact.findMany({
          where: { id: { in: clusterIds }, deletedAt: null },
        });

        const phoneExists = clusterContacts.some((c) => c.phoneNumber === phoneNumber);
        if (!phoneExists) {
          await prisma.contact.create({
            data: {
              email: null,
              phoneNumber,
              linkedId: primaryId,
              linkPrecedence: 'secondary',
            },
          });
        }
      }
    }

    return buildResponse(primaryId);
  }

  // Case 4: Multiple primary clusters - merge them
  const primaryIdArray = Array.from(primaryIds);
  const oldestPrimary = primaryIdArray.reduce((oldest, current) => {
    const oldestContact = primaryContactMap.get(oldest)!;
    const currentContact = primaryContactMap.get(current)!;
    return oldestContact.createdAt < currentContact.createdAt ? oldest : current;
  });

  const newerPrimaries = primaryIdArray.filter((id) => id !== oldestPrimary);

  // Convert newer primary contacts and their descendants to secondary
  for (const newerId of newerPrimaries) {
    const newerClusterIds = await getContactCluster(newerId);

    for (const clusterId of newerClusterIds) {
      if (clusterId !== newerId) {
        // Update secondary contacts' linkedId if they were linked to the newer primary
        await prisma.contact.update({
          where: { id: clusterId },
          data: { linkedId: oldestPrimary },
        });
      }
    }

    // Convert the newer primary to secondary
    await prisma.contact.update({
      where: { id: newerId },
      data: {
        linkPrecedence: 'secondary',
        linkedId: oldestPrimary,
      },
    });
  }

  // Add new email/phone if not already in the merged cluster
  if (email || phoneNumber) {
    const mergedClusterIds = await getContactCluster(oldestPrimary);
    const mergedContacts = await prisma.contact.findMany({
      where: { id: { in: mergedClusterIds }, deletedAt: null },
    });

    const emailExists = email ? mergedContacts.some((c) => c.email === email) : true;
    const phoneExists = phoneNumber
      ? mergedContacts.some((c) => c.phoneNumber === phoneNumber)
      : true;

    if (!emailExists || !phoneExists) {
      await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkedId: oldestPrimary,
          linkPrecedence: 'secondary',
        },
      });
    }
  }

  return buildResponse(oldestPrimary);
}

export { ContactResponse };
