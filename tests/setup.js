const { initializeContainer } = require('../container/serviceRegistration');
const sql = require('../utils/postgres');
const db = require('../utils/database');

// Test database setup
beforeAll(async () => {
  try {
    // Initialize dependency injection container
    initializeContainer();

    // Test database connection
    await sql`SELECT 1 as test`;

    console.log('Test database connected successfully');
  } catch (error) {
    console.error('Failed to connect to test database:', error.message);
    // Don't fail tests if database is not available
  }
});

afterAll(async () => {
  try {
    // Close database connection
    await sql.end();
    console.log('Test database connection closed');
  } catch (error) {
    console.warn('Error closing test database connection:', error.message);
  }
});

// Global test helpers
global.testHelpers = {
  createTestUser: async (userData = {}) => {
    const bcrypt = require('bcryptjs');
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 12),
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      isVerified: true,
      ...userData
    };
    return await db.users.create(defaultUser);
  },

  createTestProduct: async (productData = {}) => {
    const defaultProduct = {
      name: 'Test Product',
      description: 'A test product for testing purposes',
      price_paise: 9999, // $99.99 in paise
      stock: 100,
      categoryId: 1, // Assume category exists
      isActive: true,
      sku: 'TEST001',
      ...productData
    };
    return await db.products.create(defaultProduct);
  },

  createTestOrder: async (orderData = {}) => {
    const defaultOrder = {
      userId: 1,
      totalAmount: 99.99,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'credit_card',
      shippingAddress: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        address: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'US'
      }),
      billingAddress: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        address: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'US'
      }),
      subtotal: 99.99,
      shippingCost: 0,
      taxAmount: 0,
      ...orderData
    };
    return await db.orders.create(defaultOrder);
  },

  loginUser: async (request, userData = {}) => {
    const user = await global.testHelpers.createTestUser(userData);
    const loginResponse = await request
      .post('/api/users/login')
      .send({
        email: user.email,
        password: 'password123'
      });

    return {
      user,
      token: loginResponse.body.data.token,
      refreshToken: loginResponse.body.data?.refreshToken
    };
  },

  createAuthHeaders: (token) => ({
    Authorization: `Bearer ${token}`
  }),

  clearDatabase: async () => {
    // Clear all tables in reverse order of dependencies
    const tables = [
      'OrderItems',
      'Orders',
      'CartItems',
      'Carts',
      'RefreshTokens',
      'Reviews',
      'Wishlists',
      'WishlistItems',
      'Users',
      'Products',
      'Categories'
    ];

    for (const tableName of tables) {
      try {
        await sql.unsafe(`DELETE FROM "${tableName}"`);
      } catch (error) {
        // Table might not exist or be empty
      }
    }
  }
};

// Setup environment for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRE = '1h';