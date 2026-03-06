import { Router, Request, Response } from 'express';
import { identify } from '../services/identifyService';

const router = Router();

/**
 * POST /identify
 * Identifies and reconciles contact information
 */
router.post('/identify', async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({
        error: 'Either email or phoneNumber must be provided',
      });
    }

    const contact = await identify({ email, phoneNumber });
    res.status(200).json({ contact });
  } catch (error) {
    console.error('Error in /identify:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
