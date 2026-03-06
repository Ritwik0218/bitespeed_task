import express from 'express';
import dotenv from 'dotenv';
import identifyRoutes from './routes/identify';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Identity Reconciliation Service',
    version: '1.0.0',
    endpoints: {
      identify: 'POST /identify',
      health: 'GET /health'
    }
  });
});

// Routes
app.use('/', identifyRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Identity Reconciliation Service listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
