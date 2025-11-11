const request = require('supertest');
const express = require('express');
const sequelize = require('../config/database');
const User = require('../models/User');
const UserService = require('../services/UserService');
const userRoutes = require('../routes/users');

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('Authentication Endpoints', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  describe('POST /api/users/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should not register user with invalid email', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should not register user with weak password', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should not register duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123'
      };

      const userService = new UserService();
      await userService.registerUser(userData);

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users/login', () => {
    beforeEach(async () => {
      const userService = new UserService();
      await userService.registerUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123'
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should not login with invalid email', async () => {
      const loginData = {
        email: 'wrong@example.com',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not login with invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});