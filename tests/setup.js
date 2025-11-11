const { sequelize } = require('../config/database');
const { initializeContainer } = require('../container/serviceRegistration');

// Test database setup
beforeAll(async () => {
  // Initialize dependency injection container
  initializeContainer();
  
  // Connect to test database
  await sequelize.authenticate();
  
  // Sync database tables
  await sequelize.sync({ force: true });
  
  console.log('Test database connected and tables created');
});

afterAll(async () => {
  // Clean up and close database connection
  await sequelize.close();
  console.log('Test database connection closed');
});

// Global test helpers
global.testHelpers = {
  createTestUser: async (userData = {}) => {
    const User = require('../models/User');
    const defaultUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user',
      ...userData
    };
    return await User.create(defaultUser);
  },
  
  createTestProduct: async (productData = {}) => {
    const Product = require('../models/Product');
    const defaultProduct = {
      name: 'Test Product',
      description: 'A test product for testing purposes',
      price: 99.99,
      category: 'Electronics',
      stock: 100,
      ...productData
    };
    return await Product.create(defaultProduct);
  },
  
  createTestOrder: async (orderData = {}) => {
    const { Order } = require('../models/Order');
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
      ...orderData
    };
    return await Order.create(defaultOrder);
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
      refreshToken: loginResponse.body.data.refreshToken
    };
  },
  
  createAuthHeaders: (token) => ({
    Authorization: `Bearer ${token}`
  }),
  
  clearDatabase: async () => {
    // Clear all tables in reverse order of dependencies
    const models = [
      'OrderItems',
      'Orders',
      'CartItems', 
      'Carts',
      'RefreshTokens',
      'Users',
      'Products'
    ];
    
    for (const modelName of models) {
      try {
        await sequelize.query(`DELETE FROM ${modelName}`, { 
          type: sequelize.QueryTypes.DELETE 
        });
      } catch (error) {
        // Table might not exist yet
      }
    }
  }
};

// Setup environment for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRE = '1h';