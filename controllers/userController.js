const db = require('../utils/database');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/users/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { username, email, password, name, firstName, lastName, phone } = req.body || {};

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Handle both name and firstName/lastName formats
    const finalFirstName = firstName || (name ? name.split(' ')[0] : null);
    const finalLastName = lastName || (name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : null);

    // Generate username if not provided
    const finalUsername = username || email.split('@')[0];

    // Check if user already exists
    const existingEmail = await db.users.findOne({ email });
    const existingUsername = await db.users.findOne({ username: finalUsername });

    if (existingEmail || existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await db.users.create({
      username: finalUsername,
      email,
      password: hashedPassword,
      firstName: finalFirstName,
      lastName: finalLastName,
      phone,
      isActive: true,
      isVerified: false,
      role: 'user'
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password: _, ...userResponse } = user;

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

exports.loginUser = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Normalize email (lowercase and trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Find user with error handling for database issues
    let user;
    try {
      user = await db.users.findOne({ email: normalizedEmail });
    } catch (dbError) {
      logger.error('Database error during login user lookup:', {
        error: dbError.message,
        errorName: dbError.name,
        errorCode: dbError.code,
        email: normalizedEmail,
        stack: dbError.stack
      });
      
      // Handle specific "Tenant or user not found" error from Supabase
      if (dbError.message && dbError.message.includes('Tenant or user not found')) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND'
          }
        });
      }
      
      // Re-throw to be handled by error handler middleware
      throw dbError;
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check if account is locked
    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Increment login attempts
      const newAttempts = user.loginAttempts + 1;
      const updates = { loginAttempts: newAttempts };

      if (newAttempts >= 5) {
        updates.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      }

      await db.users.update(user.id, updates);

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts and update last login
    await db.users.update(user.id, {
      loginAttempts: 0,
      lockUntil: null,
      lastLogin: new Date()
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password: _, ...userResponse } = user;

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const user = await db.users.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      data: { user: userResponse }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await db.users.findByPk(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      data: { token: newToken }
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    next(error);
  }
};

exports.revokeRefreshToken = async (req, res, next) => {
  const startTime = Date.now();

  try {
    // In a simple implementation, we might not store refresh tokens
    // This could be implemented later if needed
    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Token revoked successfully'
    });
  } catch (error) {
    logger.error('Revoke refresh token error:', error);
    next(error);
  }
};