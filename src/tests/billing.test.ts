import request from 'supertest';

const mockConnectDb = jest.fn();
const mockStartScheduler = jest.fn();
const mockFetch = jest.fn();
let mockUserId: string | null = 'user_billing_123';

jest.mock('../config/db', () => ({
  __esModule: true,
  default: () => mockConnectDb(),
}));

jest.mock('../services/scheduler', () => ({
  startScheduler: () => mockStartScheduler(),
}));

jest.mock('../config/s3uploader', () => ({
  __esModule: true,
  default: {
    single: () => (req: unknown, res: unknown, next: () => void) => next(),
  },
}));

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req: any, res: any, next: any) => next(),
  getAuth: () => ({
    sessionClaims: {
      email: 'billing@example.com',
    },
    userId: mockUserId,
  }),
}));

import app from '../server';

describe('Billing API Endpoints', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_ID = 'price_123';
    (global as typeof globalThis & { fetch: typeof mockFetch }).fetch = mockFetch;
    mockFetch.mockReset();
    mockUserId = 'user_billing_123';
  });

  it('should reject checkout creation when the user is not authenticated', async () => {
    mockUserId = null;
    const res = await request(app).post('/api/billing/checkout');

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error', 'Authentication required');
  });

  it('should create a Stripe checkout session and return its URL', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      }),
      ok: true,
    });

    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Origin', 'http://localhost:5173');

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('url', 'https://checkout.stripe.com/pay/cs_test_123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/checkout/sessions',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
