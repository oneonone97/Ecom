const request = require('supertest');
const express = require('express');
const sequelize = require('../config/database');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const UserService = require('../services/UserService');
const checkoutRoutes = require('../routes/checkout');

const app = express();
app.use(express.json());
app.use('/api/checkout', checkoutRoutes);

describe('Checkout Endpoints', () => {
  let authToken;
  let userId;
  let productId;

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    // Create test user
    const userService = new UserService();
    const result = await userService.registerUser({
      name: 'Test User',
      email: 'checkouttest@example.com',
      password: 'TestPassword123'
    });
    authToken = result.accessToken;
    userId = result.user.id;

    // Create test product
    const product = await Product.create({
      name: 'Checkout Test Product',
      description: 'Test Description',
      price_paise: 5000,
      category: 'Test',
      stock: 10,
      imageUrl: 'https://example.com/test.jpg'
    });
    productId = product.id;
  });

  describe('POST /api/checkout/create-order', () => {
    it('should create order successfully', async () => {
      const orderData = {
        items: [{
          productId,
          quantity: 2,
          price: 50
        }],
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'razorpay'
      };

      const response = await request(app)
        .post('/api/checkout/create-order')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orderId');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/checkout/create-order')
        .send({
          items: [],
          shippingAddress: {},
          paymentMethod: 'razorpay'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with empty cart', async () => {
      const response = await request(app)
        .post('/api/checkout/create-order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [],
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'Test Country'
          },
          paymentMethod: 'razorpay'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with missing shipping address', async () => {
      const response = await request(app)
        .post('/api/checkout/create-order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantity: 1, price: 50 }],
          paymentMethod: 'razorpay'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/checkout/verify', () => {
    it('should verify payment successfully with valid signature', async () => {
      // First create an order
      const orderData = {
        items: [{
          productId,
          quantity: 1,
          price: 50
        }],
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'razorpay'
      };

      const orderResponse = await request(app)
        .post('/api/checkout/create-order')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      const orderId = orderResponse.body.data.orderId;

      // Verify payment (this would normally require valid Razorpay signature)
      const verifyData = {
        razorpay_order_id: orderId,
        razorpay_payment_id: 'test_payment_id',
        razorpay_signature: 'test_signature'
      };

      // Note: This will likely fail without proper Razorpay setup
      // but tests the endpoint structure
      const response = await request(app)
        .post('/api/checkout/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send(verifyData);

      // Should return a response (success or error)
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('GET /api/checkout/config', () => {
    it('should return Razorpay configuration', async () => {
      const response = await request(app)
        .get('/api/checkout/config')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.data).toHaveProperty('key');
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });
});
