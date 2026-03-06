# Testing Guide - Identity Reconciliation Service

## Quick Start

### Start the Server
```bash
npm run dev
# or for production build
npm start
```

The server will be available at `http://localhost:3000`

## API Testing

### Test 1: Health Check
**Verify the service is running**

```bash
curl -X GET http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "OK"
}
```

---

## Reconciliation Test Cases

### Case 1: New Contact Creation
**Scenario:** No existing contact matches the provided email or phone

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "phoneNumber": "+1111111111"
  }'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["alice@example.com"],
    "phoneNumbers": ["+1111111111"],
    "secondaryContactIds": []
  }
}
```

**What happens:**
- New primary contact created with id=1
- Email: alice@example.com
- Phone: +1111111111

---

### Case 2: Exact Match - Same Cluster
**Scenario:** Both email and phone already exist in the same contact

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "phoneNumber": "+1111111111"
  }'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["alice@example.com"],
    "phoneNumbers": ["+1111111111"],
    "secondaryContactIds": []
  }
}
```

**What happens:**
- Exact match found for contact id=1
- Returns the consolidated cluster data
- No new contacts created

---

### Case 3: Partial Match - New Email (Same Phone)
**Scenario:** Phone matches existing contact, but email is new

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice.newemail@example.com",
    "phoneNumber": "+1111111111"
  }'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["alice@example.com", "alice.newemail@example.com"],
    "phoneNumbers": ["+1111111111"],
    "secondaryContactIds": [2]
  }
}
```

**What happens:**
- Phone +1111111111 matches existing primary contact (id=1)
- Email alice.newemail@example.com is new
- Secondary contact created (id=2):
  - linkedId = 1 (primary contact)
  - email = alice.newemail@example.com
  - phoneNumber = null
- Response includes both emails and the secondary contact id

---

### Case 3b: Partial Match - New Phone (Same Email)
**Scenario:** Email matches existing contact, but phone is new

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "phoneNumber": "+3333333333"
  }'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["alice@example.com"],
    "phoneNumbers": ["+1111111111", "+3333333333"],
    "secondaryContactIds": [3]
  }
}
```

**What happens:**
- Email alice@example.com matches existing primary contact (id=1)
- Phone +3333333333 is new
- Secondary contact created (id=3):
  - linkedId = 1 (primary contact)
  - email = null
  - phoneNumber = +3333333333
- Response includes both phone numbers and the secondary contact id

---

### Case 4: Cluster Merge
**Scenario:** Email from one primary cluster and phone from another primary cluster

#### Setup
First, create two separate primary clusters:

```bash
# Create Alice's cluster
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "phoneNumber": "+1111111111"}'

# Create Bob's cluster
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "bob@example.com", "phoneNumber": "+2222222222"}'
```

#### Merge Request
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "phoneNumber": "+2222222222"
  }'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["alice@example.com", "bob@example.com"],
    "phoneNumbers": ["+1111111111", "+2222222222"],
    "secondaryContactIds": [2]
  }
}
```

**What happens:**
1. Email alice@example.com belongs to primary contact (id=1)
2. Phone +2222222222 belongs to primary contact (id=4, Bob)
3. Older primary (id=1, Alice) is determined
4. Newer primary (id=4, Bob) is converted to secondary:
   - linkPrecedence = "secondary"
   - linkedId = 1 (Alice)
5. All of Bob's contacts are now linked to Alice
6. Response consolidates all emails and phones from both clusters

---

## Complete Test Sequence

Run this complete sequence to verify all functionality:

```bash
#!/bin/bash

echo "=== Test 1: Create Alice's Primary Cluster ==="
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+1111111111"}' | jq .

echo ""
echo "=== Test 2: Exact Match (No Change) ==="
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+1111111111"}' | jq .

echo ""
echo "=== Test 3: Add New Email to Alice ==="
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.work@example.com","phoneNumber":"+1111111111"}' | jq .

echo ""
echo "=== Test 4: Create Bob's Primary Cluster ==="
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","phoneNumber":"+2222222222"}' | jq .

echo ""
echo "=== Test 5: Merge Clusters (Alice's Email + Bob's Phone) ==="
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+2222222222"}' | jq .

echo ""
echo "=== Test 6: Verify Merged Result ==="
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","phoneNumber":"+1111111111"}' | jq .
```

---

## Database Verification

### View database with Prisma Studio
```bash
npm run prisma:studio
```

This opens a web UI to browse and manage contacts directly.

### Query database with SQLite (if using SQLite)
```bash
sqlite3 dev.db "SELECT * FROM Contact;"
```

### Query with PostgreSQL (if using PostgreSQL)
```bash
psql $DATABASE_URL -c "SELECT * FROM \"Contact\";"
```

---

## Error Testing

### Missing Both Email and Phone
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Either email or phoneNumber must be provided"
}
```

### Only Email
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Expected Response (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": X,
    "emails": ["test@example.com"],
    "phoneNumbers": [],
    "secondaryContactIds": []
  }
}
```

### Only Phone
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+9876543210"}'
```

**Expected Response (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": Y,
    "emails": [],
    "phoneNumbers": ["+9876543210"],
    "secondaryContactIds": []
  }
}
```

---

## Advanced Scenarios

### Scenario 1: Deep Cluster with Multiple Secondaries
```bash
# Create primary
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"primary@test.com","phoneNumber":"+1000000000"}' | jq .

# Add secondary 1
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"sec1@test.com","phoneNumber":"+1000000000"}' | jq .

# Add secondary 2
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"sec2@test.com","phoneNumber":"+1000000000"}' | jq .

# Verify all are consolidated
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"primary@test.com","phoneNumber":"+9999999999"}' | jq .
```

Expected: All 4 unique emails in response, 2 secondary IDs

---

## Performance Notes

- For **new contacts**: Creates instantly
- For **exact matches**: Retrieves from cache layer
- For **partial matches**: Single write operation
- For **cluster merges**: Multiple updates (optimized for consistency)

## Using jq for Pretty Output

If `jq` is not installed:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Or use Python for formatting
curl -s ... | python -m json.tool
```

---

## Automated Test Script

Use the provided test script:
```bash
./test-api.sh
```

This runs all major test cases automatically.

---

## Reset Database (Development)

To clear all data and start fresh:
```bash
npm run prisma:reset
```

**Warning:** This deletes all data!

---

## Notes

- All timestamps are in UTC
- IDs are auto-incrementing integers
- Response order: Primary emails first, then secondary
- Phone numbers follow same order as emails
- Secondary contact IDs appear in creation order
