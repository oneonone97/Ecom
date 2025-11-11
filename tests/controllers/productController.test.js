const request = require('supertest');
const app = require('../../server');

describe('Product Controller', () => {
  let authToken;
  let adminToken;

  beforeEach(async () => {
    await global.testHelpers.clearDatabase();
    
    // Create regular user
    const userAuth = await global.testHelpers.loginUser(request(app));
    authToken = userAuth.token;
    
    // Create admin user
    const adminAuth = await global.testHelpers.loginUser(request(app), {
      email: 'admin@test.com',
      role: 'admin'
    });
    adminToken = adminAuth.token;
  });

  describe('GET /api/products', () => {
    beforeEach(async () => {
      // Create test products
      await global.testHelpers.createTestProduct({
        name: 'Product 1',
        category: 'Electronics',
        price: 99.99
      });
      await global.testHelpers.createTestProduct({
        name: 'Product 2',
        category: 'Smartphones',
        price: 199.99
      });
    });

    it('should get all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products?category=Electronics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe('Electronics');
    });

    it('should paginate products', async () => {
      const response = await request(app)
        .get('/api/products?page=1&limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalPages).toBe(2);
    });
  });

  describe('GET /api/products/:id', () => {
    let product;

    beforeEach(async () => {
      product = await global.testHelpers.createTestProduct();
    });

    it('should get single product', async () => {
      const response = await request(app)
        .get(`/api/products/${product.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(product.id);
      expect(response.body.data.name).toBe(product.name);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/products', () => {
    const productData = {
      name: 'New Product',
      description: 'A new test product',
      price: 149.99,
      category: 'Electronics',
      stock: 25
    };

    it('should create product as admin', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(productData.name);
      expect(response.body.data.price).toBe('149.99');
    });

    it('should reject creation without admin role', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should reject creation without authentication', async () => {
      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Test Product'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/products/:id', () => {
    let product;

    beforeEach(async () => {
      product = await global.testHelpers.createTestProduct();
    });

    it('should update product as admin', async () => {
      const updateData = {
        name: 'Updated Product',
        price: 199.99
      };

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Product');
      expect(parseFloat(response.body.data.price)).toBe(199.99);
    });

    it('should reject update without admin role', async () => {
      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .put('/api/products/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/products/:id', () => {
    let product;

    beforeEach(async () => {
      product = await global.testHelpers.createTestProduct();
    });

    it('should delete product as admin', async () => {
      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should reject deletion without admin role', async () => {
      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .delete('/api/products/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/products/search', () => {
    beforeEach(async () => {
      await global.testHelpers.createTestProduct({
        name: 'iPhone 13',
        description: 'Apple smartphone'
      });
      await global.testHelpers.createTestProduct({
        name: 'Samsung Galaxy',
        description: 'Android smartphone'
      });
    });

    it('should search products', async () => {
      const response = await request(app)
        .get('/api/products/search?q=iPhone')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('iPhone 13');
    });

    it('should require search term', async () => {
      const response = await request(app)
        .get('/api/products/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Search term is required');
    });
  });

  describe('GET /api/products/categories', () => {
    beforeEach(async () => {
      await global.testHelpers.createTestProduct({ category: 'Electronics' });
      await global.testHelpers.createTestProduct({ category: 'Smartphones' });
      await global.testHelpers.createTestProduct({ category: 'Electronics' });
    });

    it('should get product categories', async () => {
      const response = await request(app)
        .get('/api/products/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toContain('Electronics');
      expect(response.body.data).toContain('Smartphones');
    });
  });
});