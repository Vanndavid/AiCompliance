import request from 'supertest';
import app from '../server';
import mongoose from 'mongoose';
import DocumentModel from '../models/Document';

// 1. MOCK AUTHENTICATION
// We tell Jest: "When the app asks for Clerk, give it this fake user instead."
// This bypasses the need for a real Bearer token.
jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req: any, res: any, next: any) => {
    req.auth = { userId: 'test_user_123' }; // Fake User ID
    next();
  },
  requireAuth: () => (req: any, res: any, next: any) => {
    // Simulate passing auth
    req.auth = { userId: 'test_user_123' };
    next();
  },
  getAuth: () => ({ userId: 'test_user_123' }), // Controller uses this
  clerkClient: {
    users: {
      getUser: async () => ({ emailAddresses: [{ emailAddress: 'test@example.com' }] })
    }
  }
}));

// Clean up DB before/after
beforeAll(async () => {
  await DocumentModel.deleteMany({}); // Clear old test data
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Document API Endpoints', () => {
  
  let uploadedDocId: string;

  // TEST CASE 1: The "Forgot File" Error
  it('should return 400 if no file is attached', async () => {
    const res = await request(app)
      .post('/api/upload'); // No .attach() here
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'No file uploaded');
  });

  // TEST CASE 2: The "Happy Path" Upload
  it('should upload a file and return 202 Accepted', async () => {
    // Create a fake file in memory
    const fileBuffer = Buffer.from('fake pdf content');

    const res = await request(app)
      .post('/api/upload')
      .attach('document', fileBuffer, 'test-license.pdf'); // Simulate file upload

    expect(res.statusCode).toEqual(202);
    expect(res.body.success).toBe(true);
    expect(res.body.file).toHaveProperty('id');
    
    // Save ID for next test
    uploadedDocId = res.body.file.id;

    // Verify it is actually in the database
    const dbRecord = await DocumentModel.findById(uploadedDocId);
    expect(dbRecord).toBeTruthy();
    expect(dbRecord?.userId).toBe('test_user_123'); // Check if linked to our fake user
    expect(dbRecord?.status).toBe('pending');
  });

  // TEST CASE 3: Fetching Status
  it('should fetch the status of the uploaded document', async () => {
    const res = await request(app)
      .get(`/api/document/${uploadedDocId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'pending');
  });

});