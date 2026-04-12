import { getAuth } from '@clerk/express';
import { Request, Response } from 'express';
import { createStripeCheckoutSession } from '../services/stripeService';

const getFrontendOrigin = (req: Request) =>
  process.env.FRONTEND_APP_URL ||
  req.headers.origin ||
  'http://localhost:5173';

export const createCheckoutSession = async (req: Request, res: Response) => {
  const { sessionClaims, userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    res.status(503).json({ error: 'Billing is not configured yet' });
    return;
  }

  const frontendOrigin = getFrontendOrigin(req);
  const customerEmail =
    typeof sessionClaims?.email === 'string'
      ? sessionClaims.email
      : typeof sessionClaims?.email_address === 'string'
        ? sessionClaims.email_address
        : undefined;

  try {
    const url = await createStripeCheckoutSession({
      cancelUrl: process.env.BILLING_CANCEL_URL || `${frontendOrigin}/?billing=cancel`,
      clerkUserId: userId,
      priceId,
      successUrl: process.env.BILLING_SUCCESS_URL || `${frontendOrigin}/?billing=success`,
      ...(customerEmail ? { customerEmail } : {}),
    });

    res.status(201).json({ url });
  } catch (error) {
    console.error('Stripe checkout creation failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to start checkout',
    });
  }
};
