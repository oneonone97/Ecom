const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

// Apply security middleware to Express app
const applySecurityMiddleware = (app) => {
  // Set comprehensive security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Prevent XSS attacks - Enhanced XSS protection
  app.use(xss({
    // Custom configuration for better compatibility
    whiteList: {
      // Allow safe HTML tags if needed for your application
      'b': [],
      'i': [],
      'em': [],
      'strong': [],
      'p': [],
      'br': []
    },
    stripIgnoreTag: true, // Remove unwhitelisted tags entirely
    stripIgnoreTagBody: ['script'], // Remove script tags and their content
  }));

  // Detect serverless environment (Vercel, AWS Lambda, etc.)
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS || false;

  // Rate limiting with different limits for different endpoints
  const createRateLimit = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        message,
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use the built-in key generator that properly handles IPv4/IPv6
    // When trust proxy is enabled in Express, req.ip will automatically use X-Forwarded-For
    keyGenerator: rateLimit.ipKeyGenerator
  });

  // General rate limiting
  const generalLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests from this IP, please try again later.'
  );
  app.use(generalLimiter);

  // Stricter rate limiting for auth endpoints
  const authLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 requests per windowMs for auth
    'Too many authentication attempts, please try again later.'
  );
  // SECURITY: Rate limiting ENABLED for login endpoint
  app.use('/api/users/login', authLimiter);
  app.use('/api/users/register', authLimiter);

  // Rate limiting for password change operations
  const passwordLimiter = createRateLimit(
    60 * 60 * 1000, // 1 hour
    3, // limit each IP to 3 password changes per hour
    'Too many password change attempts, please try again later.'
  );
  app.use('/api/users/change-password', passwordLimiter);

  // Rate limiting for profile updates
  const profileLimiter = createRateLimit(
    5 * 60 * 1000, // 5 minutes
    10, // limit each IP to 10 profile updates per 5 minutes
    'Too many profile update attempts, please try again later.'
  );
  app.use('/api/users/me', profileLimiter);

  // Rate limiting for order creation (prevent spam orders)
  const orderLimiter = createRateLimit(
    10 * 60 * 1000, // 10 minutes
    5, // limit each IP to 5 orders per 10 minutes
    'Too many order attempts, please try again later.'
  );
  app.use('/api/orders', orderLimiter);

  // Rate limiting for cart modifications
  const cartLimiter = createRateLimit(
    1 * 60 * 1000, // 1 minute
    30, // limit each IP to 30 cart operations per minute
    'Too many cart operations, please slow down.'
  );
  app.use('/api/cart', cartLimiter);

  // Prevent http param pollution
  app.use(hpp({
    whitelist: ['sort', 'fields', 'page', 'limit', 'category']
  }));

  // Additional security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  return app;
};

module.exports = applySecurityMiddleware;