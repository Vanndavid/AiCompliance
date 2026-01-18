/// <reference types="jest" />
import request from 'supertest';
import app from '../server'; // Import your Express App
import mongoose from 'mongoose';

// Close DB connection after tests
afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /api/health', () => {
  it('should return 200 OK and status active', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'active');
  });
});