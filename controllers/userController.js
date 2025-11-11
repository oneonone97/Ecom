const { container } = require('../container/serviceRegistration');
const logger = require('../utils/logger');

// @desc    Register user
// @route   POST /api/users/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const userService = container.resolve('userService');
    const { name, email, password } = req.body;

    const result = await userService.registerUser({ name, email, password });

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
exports.loginUser = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const userService = container.resolve('userService');
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
        timestamp: new Date().toISOString()
      });
    }

    const result = await userService.loginUser(email, password);

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Get current logged in user
// @route   GET /api/users/me
// @access  Private
exports.getMe = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const userService = container.resolve('userService');
    const user = await userService.getUserProfile(req.user.id);

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Update user profile
// @route   PUT /api/users/me
// @access  Private
exports.updateProfile = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const userService = container.resolve('userService');
    const updatedUser = await userService.updateUserProfile(req.user.id, req.body);

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const userService = container.resolve('userService');
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        timestamp: new Date().toISOString()
      });
    }

    const result = await userService.changePassword(req.user.id, currentPassword, newPassword);

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Refresh access token
// @route   POST /api/users/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const userService = container.resolve('userService');
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        timestamp: new Date().toISOString()
      });
    }

    const result = await userService.refreshAccessToken(refreshToken);

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};

// @desc    Revoke refresh token
// @route   POST /api/users/revoke-token
// @access  Private
exports.revokeRefreshToken = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const userService = container.resolve('userService');
    const { refreshToken, revokeAll } = req.body;

    let result;
    if (revokeAll) {
      result = await userService.revokeAllUserTokens(req.user.id);
    } else {
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          timestamp: new Date().toISOString()
        });
      }
      result = await userService.revokeRefreshToken(refreshToken);
    }

    logger.logRequest(req, res, Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.logError(error, req);
    next(error); // Pass to global error handler
  }
};