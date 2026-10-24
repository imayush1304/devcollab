import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Authentication API & Security Tests', () => {
  const validUserData = {
    name: 'Ayush Sharma',
    email: 'ayush@example.com',
    password: 'Password123'
  };

  describe('POST /api/auth/register', () => {
    it('successfully registers a new user with hashed password and returns token + cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.name).toBe(validUserData.name);
      expect(res.body.data.user.email).toBe(validUserData.email);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.token).toBeDefined();

      // Verify Set-Cookie header contains HttpOnly devcollab_token
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('devcollab_token'))).toBe(true);

      // Verify stored password in database is hashed (not plaintext)
      const savedUser = await User.findOne({ email: validUserData.email }).select('+passwordHash');
      expect(savedUser).not.toBeNull();
      expect(savedUser.passwordHash).not.toBe(validUserData.password);
      expect(savedUser.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('rejects registration with a duplicate email with 409 Conflict', async () => {
      // First registration
      await request(app).post('/api/auth/register').send(validUserData);

      // Duplicate registration attempt
      const res = await request(app).post('/api/auth/register').send(validUserData);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already exists');
    });

    it('rejects registration when password does not meet security requirements', async () => {
      const weakPasswordData = {
        name: 'Weak User',
        email: 'weak@example.com',
        password: 'weak' // Too short, no uppercase, no numbers
      };

      const res = await request(app).post('/api/auth/register').send(weakPasswordData);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('rejects registration with invalid email format', async () => {
      const invalidEmailData = {
        name: 'Invalid Email',
        email: 'not-an-email',
        password: 'Password123'
      };

      const res = await request(app).post('/api/auth/register').send(invalidEmailData);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register test user
      await request(app).post('/api/auth/register').send(validUserData);
    });

    it('successfully logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: validUserData.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUserData.email);
      expect(res.body.data.token).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies.some(c => c.includes('devcollab_token'))).toBe(true);
    });

    it('rejects login with incorrect password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: 'WrongPassword999'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects login with non-existent email with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Protected Route: GET /api/auth/me', () => {
    let authToken;
    let authCookie;

    beforeEach(async () => {
      const regRes = await request(app).post('/api/auth/register').send(validUserData);
      authToken = regRes.body.data.token;
      authCookie = regRes.headers['set-cookie'];
    });

    it('successfully returns user profile when Authorization Bearer header is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUserData.email);
      expect(res.body.data.user.name).toBe(validUserData.name);
    });

    it('successfully returns user profile when HttpOnly cookie is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUserData.email);
    });

    it('rejects access with 401 Unauthorized when no credentials are provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects access with 401 when an invalid token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer forged_fake_token_12345');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie on logout', async () => {
      const regRes = await request(app).post('/api/auth/register').send(validUserData);
      const authCookie = regRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      // Cookie is expired/cleared
      expect(cookies.some(c => c.includes('devcollab_token=;') || c.includes('Expires='))).toBe(true);
    });
  });
});
