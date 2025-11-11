const request = require('supertest');
const express = require('express');
const sequelize = require('../config/database');
const Product = require('../models/Product');
const User = require('../models/User');
const UserService = require('../services/UserService');
const productRoutes = require('../routes/products');
const { protect, authorize } = require('../middleware/auth');

const app = express();
app.use(express.json());
app.use(protect);
app.use('/api/products', productRoutes);

describe('Products Endpoints', () => {
  let adminToken;
  let userToken;
  let testProduct;
  let userService;

  beforeEach(async () => {
    await sequelize.sync({ force: true });
    userService = new UserService();

    // Create admin user
    const adminData = {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Password123'
    };
    const adminResult = await userService.registerUser(adminData);
    await User.update({ role: 'admin' }, { where: { id: adminResult.user.id } });
    adminToken = adminResult.accessToken;

    // Create regular user
    const userData = {
      name: 'Regular User',
      email: 'user@example.com',
      password: 'Password123'
    };
    const userResult = await userService.registerUser(userData);
    userToken = userResult.accessToken;

    // Create test product
    testProduct = await Product.create({
      name: 'Test Smartphone',
      description: 'A great smartphone for testing',
      price: 699.99,
      category: 'Smartphones',
      stock: 10
    });
  });

  describe('GET /api/products', () => {
    it('should get all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Test Smartphone');
    });

    it('should filter products by category', async () => {
      await Product.create({
        name: 'Test Laptop',
        description: 'A great laptop for testing',
        price: 999.99,
        category: 'Laptops',
        stock: 5
      });

      const response = await request(app)
        .get('/api/products?category=Smartphones')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].category).toBe('Smartphones');
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get single product by ID', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Smartphone');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = 99999;
      const response = await request(app)
        .get(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/products', () => {
    it('should create product as admin', async () => {
      const productData = {
        name: 'New Product',
        description: 'A new product for testing',
        price: 299.99,
        category: 'Tablets',
        stock: 15
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(productData.name);
    });

    it('should not create product as regular user', async () => {
      const productData = {
        name: 'New Product',
        description: 'A new product for testing',
        price: 299.99,
        category: 'Tablets',
        stock: 15
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send(productData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update product as admin', async () => {
      const updateData = {
        name: 'Updated Product',
        price: 799.99
      };

      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete product as admin', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});