const crypto = require('crypto');
const logger = require('../utils/logger');

// In-memory store for CSRF tokens (use Redis in production)
const csrfTokens = new Map();

// Clean up expired tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.timestamp > 30 * 60 * 1000) { // 30 minutes
      csrfTokens.delete(token);
    }
  }
}, 30 * 60 * 1000);

// Generate secure CSRF token
const generateCSRFToken = (userId, sessionId) => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(32);
  const token = crypto
    .createHash('sha256')
    .update(`${userId}-${sessionId}-${timestamp}-${randomBytes.toString('hex')}`)
    .digest('hex');
  
  // Store token with metadata
  csrfTokens.set(token, {
    userId,
    sessionId,
    timestamp,
    used: false
  });
  
  return token;
};

// Validate CSRF token
const validateCSRFToken = (token, userId, sessionId) => {
  const tokenData = csrfTokens.get(token);
  
  if (!tokenData) {
    return false;
  }
  
  // Check if token matches user and session
  if (tokenData.userId !== userId || tokenData.sessionId !== sessionId) {
    return false;
  }
  
  // Check if token is expired (30 minutes)
  if (Date.now() - tokenData.timestamp > 30 * 60 * 1000) {
    csrfTokens.delete(token);
    return false;
  }
  
  // Check if token was already used (one-time use)
  if (tokenData.used) {
    return false;
  }
  
  // Mark token as used
  tokenData.used = true;
  
  return true;
};

// Middleware to provide CSRF token
const provideCSRFToken = (req, res, next) => {
  // Generate session ID if not present
  if (!req.sessionId) {
    req.sessionId = crypto.randomBytes(16).toString('hex');
  }
  
  // Generate CSRF token for authenticated users
  if (req.user) {
    const csrfToken = generateCSRFToken(req.user.id, req.sessionId);
    res.locals.csrfToken = csrfToken;
    
    // Add token to response headers for SPA applications
    res.setHeader('X-CSRF-Token', csrfToken);
  }
  
  next();
};

// Middleware to validate CSRF token
const validateCSRF = (req, res, next) => {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF validation for non-authenticated endpoints
  if (!req.user) {
    return next();
  }
  
  // Get CSRF token from various sources
  const token = req.body._csrf || 
                req.query._csrf || 
                req.headers['x-csrf-token'] || 
                req.headers['csrf-token'];
  
  if (!token) {
    logger.logSecurity('CSRF token missing', {
      userId: req.user?.id,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      errorCode: 'CSRF_TOKEN_MISSING',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate token
  const sessionId = req.sessionId || req.headers['x-session-id'];
  
  if (!validateCSRFToken(token, req.user.id, sessionId)) {
    logger.logSecurity('Invalid CSRF token', {
      userId: req.user.id,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      tokenProvided: !!token
    });
    
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      errorCode: 'CSRF_TOKEN_INVALID',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Endpoint to get CSRF token
const getCSRFToken = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      timestamp: new Date().toISOString()
    });
  }
  
  const sessionId = req.sessionId || crypto.randomBytes(16).toString('hex');
  const csrfToken = generateCSRFToken(req.user.id, sessionId);
  
  res.json({
    success: true,
    data: {
      csrfToken,
      sessionId
    }
  });
};

// Apply CSRF protection to specific routes
const csrfProtection = [provideCSRFToken, validateCSRF];

module.exports = {
  provideCSRFToken,
  validateCSRF,
  csrfProtection,
  getCSRFToken
};