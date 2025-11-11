const request = require('supertest');
const express = require('express');
const sequelize = require('../config/database');
const User = require('../models/User');
const Product = require('../models/Product');
const { Cart, CartItem } = require('../models/Cart');
const UserService = require('../services/UserService');
const cart Routes = require('../routes/cart');
const { protect } = require('../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/cart', cartRoutes);

describe('Cart Endpoints', () => {
  let authToken;
  let userId;
  let productId;

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    // Create test user
    const userService = new UserService();
    const result = await userService.registerUser({
      name: 'Test User',
      email: 'carttest@example.com',
      password: 'TestPassword123'
    });
    authToken = result.accessToken;
    userId = result.user.id;

    // Create test product
    const product = await Product.create({
      name: 'Test Product',
      description: 'Test Description',
      price_paise: 9999,
      category: 'Test',
      stock: 10,
      imageUrl: 'https://example.com/test.jpg'
    });
    productId = product.id;
  });

  describe('POST /api/cart', () => {
    it('should add item to cart successfully', async () => {
      const response = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId, quantity: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('added to cart');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/cart')
        .send({ productId, quantity: 1 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid product ID', async () => {
      const response = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: 99999, quantity: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with quantity exceeding stock', async () => {
      const response = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId, quantity: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('stock');
    });
  });

  describe('GET /api/cart', () => {
    it('should get empty cart initially', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items || []).toHaveLength(0);
    });

    it('should get cart with items after adding', async () => {
      // Add item first
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId, quantity: 2 });

      // Get cart
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].quantity).toBe(2);
    });
  });

  describe('PUT /api/cart/:itemId', () => {
    it('should update cart item quantity', async () => {
      // Add item
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId, quantity: 1 });

      // Get cart to find item ID
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      const itemId = cartResponse.body.data.items[0].id;

      // Update quantity
      const response = await request(app)
        .put(`/api/cart/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/cart/:itemId', () => {
    it('should remove item from cart', async () => {
      // Add item
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId, quantity: 1 });

      // Get cart to find item ID
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      const itemId = cartResponse.body.data.items[0].id;

      // Delete item
      const response = await request(app)
        .delete(`/api/cart/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/cart', () => {
    it('should clear entire cart', async () => {
      // Add item
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId, quantity: 1 });

      // Clear cart
      const response = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify cart is empty
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(cartResponse.body.data.items || []).toHaveLength(0);
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });
});
