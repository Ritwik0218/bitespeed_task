# Identity Reconciliation Service

A Node.js TypeScript web service that reconciles and identifies contacts based on email addresses and phone numbers. This service handles contact clustering and prevents duplicate contacts by intelligently merging contact information.

## Features

- **POST /identify** endpoint for contact identification and reconciliation
- Automatic contact clustering and deduplication
- Support for four reconciliation cases:
  1. New contact creation
  2. Exact match detection
  3. Partial match handling with secondary contacts
  4. Intelligent merging of primary contact clusters
- SQLite database with Prisma ORM
- TypeScript for type safety
- Express.js framework

## Project Structure

```
├── src/
│   ├── index.ts                 # Express app entry point
│   ├── routes/
│   │   └── identify.ts          # /identify endpoint
│   └── services/
│       └── identifyService.ts   # Core reconciliation logic
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Database migrations
├── dist/                        # Compiled JavaScript
├── package.json
├── tsconfig.json
└── .env
```

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd identity-reconciliation
```

2. Install dependencies:
```bash
npm install
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Setup the database (applies migrations):
```bash
npm run prisma:migrate
```

## Development

Start the development server:
```bash
npm run dev
```

The service will start on `http://localhost:3000`

## Building

Compile TypeScript to JavaScript:
```bash
npm run build
```

## Production

Start the production server:
```bash
npm run start
```

## API Documentation

### POST /identify

Identifies and reconciles contact information.

**Request:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "+1234567890"
}
```

**Response (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["user@example.com", "other@example.com"],
    "phoneNumbers": ["+1234567890", "+0987654321"],
    "secondaryContactIds": [2, 3]
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Either email or phoneNumber must be provided"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "OK"
}
```

## Database Schema

### Contact Table

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| phoneNumber | String (nullable) | Phone number |
| email | String (nullable) | Email address |
| linkedId | Int (nullable) | Reference to parent primary contact |
| linkPrecedence | String | "primary" or "secondary" |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |
| deletedAt | DateTime (nullable) | Soft delete timestamp |

## Core Logic

### Reconciliation Cases

1. **No Match**: Creates a new primary contact
2. **Exact Match**: Returns consolidated data for existing contact cluster
3. **Partial Match**: Creates a secondary contact linked to the primary
4. **Cluster Merge**: When email and phone belong to different primary clusters, the newer primary becomes secondary and links to the older primary

### Contact Clusters

The service maintains contact clusters where:
- Each cluster has exactly one primary contact
- Secondary contacts link to a primary (directly or indirectly)
- All contacts in a cluster are consolidated in responses
- The response includes all emails and phone numbers from all contacts in the cluster

## Deployment on Render.com

### Prerequisites
- GitHub account with the repository pushed
- Render account

### Steps

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Create Render Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository branch

3. **Configure Build Settings**
   - **Name**: `identity-reconciliation` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build && npm run prisma:generate && npm run prisma:migrate`
   - **Start Command**: `npm start`

4. **Set Environment Variables**
   - Click on the service after creation
   - Go to "Environment" tab
   - Add the following variables:
     - **DATABASE_URL**: `file:./data/prod.db` (SQLite for simple deployment)
     - **PORT**: `3000` (or leave empty for Render's default)
     - **NODE_ENV**: `production`

   **Note**: For production use with multiple instances, consider using PostgreSQL instead of SQLite:
   - Add PostgreSQL database through Render
   - Set `DATABASE_URL` to the connection string provided

5. **Deploy**
   - Render will automatically deploy on push to the connected branch
   - Monitor deployment in the "Events" tab
   - Once deployed, your service will be accessible at `https://<service-name>.onrender.com`

### Using PostgreSQL Instead of SQLite

For production deployments with better concurrency handling:

1. Create a PostgreSQL database in Render
2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Update the build command to include PostgreSQL setup:
   ```
   npm install && npm run build && npm run prisma:generate && npm run prisma:migrate
   ```

4. Set the DATABASE_URL environment variable to the PostgreSQL connection string

### Health Check

After deployment, verify the service is running:
```bash
curl https://<service-name>.onrender.com/health
```

## Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=development
```

For Render deployment with PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@host:5432/database"
PORT=3000
NODE_ENV=production
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript
- `npm start` - Start production server
- `npm run prisma:migrate` - Create and apply database migrations
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:reset` - Reset database (development only)
- `npm run prisma:studio` - Open Prisma Studio UI

## Testing

Example API calls:

```bash
# Create new primary contact
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+1111111111"}'

# Exact match
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+1111111111"}'

# Partial match (new email)
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.newemail@example.com","phoneNumber":"+1111111111"}'

# Merge clusters
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","phoneNumber":"+1111111111"}'
```

## Troubleshooting

### Database errors on Render
- Ensure `prisma:migrate` is in the build command
- Check that DATABASE_URL is properly set
- For SQLite, the `./data` directory must exist (Render creates it automatically)

### Port binding errors
- Ensure PORT environment variable is set correctly
- Default port is 3000

### Build failures
- Check Node.js version: `node --version`
- Ensure `npm install` completes successfully
- Verify all environment variables are set

## License

ISC

## Contact

For questions or issues, please create an issue in the repository.
