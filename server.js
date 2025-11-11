const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const serverless = require('serverless-http');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const applySecurityMiddleware = require('./middleware/security');
// Database connection removed - now using raw SQL
const { initializeContainer } = require('./container/serviceRegistration');
const { protect, logout } = require('./middleware/auth');
const { getCSRFToken } = require('./middleware/csrf');
const { initializeRedis } = require('./config/redis');

// Load environment variables
dotenv.config();

// Initialize dependency injection container
try {
  initializeContainer();
} catch (error) {
  logger.error('Failed to initialize dependency injection container:', error);
  process.exit(1);
}

// Initialize Redis (non-blocking for development)
// In serverless environments, don't exit on Redis failure - use fallback instead
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS || false;
initializeRedis().catch(error => {
  if (isServerless) {
    // In serverless, gracefully degrade without Redis (use in-memory fallback)
    logger.warn('Redis unavailable in serverless environment, using in-memory fallback:', error.message);
  } else if (process.env.NODE_ENV === 'production') {
    // In non-serverless production, Redis is critical - exit
    logger.error('Failed to initialize Redis in production:', error);
    process.exit(1);
  } else {
    // In development, continue without Redis
    logger.warn('Failed to initialize Redis in development:', error.message);
  }
});

const crypto = require('crypto');

// Initialize Express app
const app = express();

// Enable trust proxy for serverless environments (Vercel, AWS Lambda, etc.)
// This is required for express-rate-limit to work correctly behind proxies
if (isServerless) {
  app.set('trust proxy', 1); // Trust first proxy (Vercel)
}

// Middleware to generate a unique session ID for each request
app.use((req, res, next) => {
  req.sessionId = req.headers['x-session-id'] || crypto.randomBytes(16).toString('hex');
  res.setHeader('X-Session-Id', req.sessionId);
  next();
});

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:5173',
  credentials: true
};
// Handle preflight requests for all routes
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Serve uploaded files from the 'uploads' directory
// Note: In serverless environments, files in /tmp are ephemeral and not suitable for serving
// For production serverless, use cloud storage (S3, Supabase Storage) instead
const path = require('path');
if (process.env.NODE_ENV !== 'production' && !isServerless) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Request logging middleware
app.use(requestLogger);

// Apply security middleware
applySecurityMiddleware(app);

// Request tracer middleware (for debugging)
const requestTracer = require('./middleware/requestTracer');
app.use(requestTracer);

// Import routes
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlist');
const paymentRoutes = require('./routes/payments');
const checkoutRoutes = require('./routes/checkout');

// Import Swagger
const { swaggerUi, specs } = require('./swagger');

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MyShop API Documentation'
}));

// Use routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', reviewRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/checkout', checkoutRoutes);

// Basic routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MyShop API is running',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      products: '/api/products',
      users: '/api/users',
      cart: '/api/cart',
      orders: '/api/orders'
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// CSRF token endpoint - must be authenticated so req.user is available
app.get('/api/csrf-token', protect, getCSRFToken);

// Logout endpoint
app.post('/api/logout', protect, logout);

// Error handler middleware (must be after routes)
app.use(errorHandler);

// Export the app for local development and testing
module.exports = app;

// For serverless deployment (Vercel, AWS Lambda, etc.), export the serverless handler
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS) {
  const serverlessHandler = serverless(app, {
    binary: ['image/*', 'application/pdf', 'application/octet-stream']
  });
  module.exports.handler = serverlessHandler;
} else {
  // For local development, listen on a port
  if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  }
}