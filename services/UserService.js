const BaseService = require('./BaseService');
const UserRepository = require('../repositories/UserRepository');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class UserService extends BaseService {
  constructor(userRepository = new UserRepository()) {
    super(userRepository);
    this.userRepository = userRepository;
  }

  async registerUser(userData) {
    try {
      const { name, email, password } = userData;

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const newUser = await this.userRepository.createUser({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword
      });

      // Remove password from response
      const userResponse = { ...newUser.toJSON() };
      delete userResponse.password;

      // Generate JWT and refresh tokens
      const accessToken = this.generateToken(newUser.id);
      const refreshToken = await RefreshToken.createToken(newUser.id);

      // Update last login
      await this.userRepository.updateLastLogin(newUser.id);

      logger.info('User registered successfully', {
        userId: newUser.id,
        email: newUser.email,
        timestamp: new Date().toISOString()
      });

      return {
        user: userResponse,
        accessToken,
        refreshToken: refreshToken.token
      };
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'registerUser');
    }
  }

  async loginUser(email, password) {
    try {
      // Find user with password
      const user = await this.userRepository.findByEmailWithPassword(email.toLowerCase().trim());
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated. Please contact support.');
      }

      // Check if account is locked
      if (user.isLocked()) {
        const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
        logger.logSecurity('Login attempt on locked account', {
          email,
          userId: user.id,
          lockTimeRemaining,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Account is locked. Try again in ${lockTimeRemaining} minutes.`);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        
        logger.logSecurity('Failed login attempt', {
          email,
          userId: user.id,
          attemptCount: user.loginAttempts + 1,
          ip: 'unknown',
          timestamp: new Date().toISOString()
        });
        
        throw new Error('Invalid email or password');
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Remove password from response
      const userResponse = { ...user.toJSON() };
      delete userResponse.password;

      // Generate JWT and refresh tokens
      const accessToken = this.generateToken(user.id);
      const refreshToken = await RefreshToken.createToken(user.id);

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString()
      });

      return {
        user: userResponse,
        accessToken,
        refreshToken: refreshToken.token
      };
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'loginUser');
    }
  }

  async getUserProfile(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove password from response
      const userResponse = { ...user.toJSON() };
      delete userResponse.password;

      return userResponse;
    } catch (error) {
      throw this.handleError(error, 'getUserProfile');
    }
  }

  async updateUserProfile(userId, updateData) {
    try {
      // Validate update data
      await this.validateUpdateData(updateData);

      // Remove sensitive fields that shouldn't be updated directly
      const sanitizedData = { ...updateData };
      delete sanitizedData.password;
      delete sanitizedData.email;
      delete sanitizedData.role;
      delete sanitizedData.isActive;

      // Trim name if provided
      if (sanitizedData.name) {
        sanitizedData.name = sanitizedData.name.trim();
      }

      const updatedUser = await this.userRepository.updateUser(userId, sanitizedData);

      // Remove password from response
      const userResponse = { ...updatedUser.toJSON() };
      delete userResponse.password;

      logger.info('User profile updated', {
        userId,
        updatedFields: Object.keys(sanitizedData),
        timestamp: new Date().toISOString()
      });

      return userResponse;
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'updateUserProfile');
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get user with password
      const user = await this.userRepository.findByEmailWithPassword(
        (await this.userRepository.findById(userId)).email
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await this.userRepository.updateUser(userId, { password: hashedNewPassword });

      logger.logSecurity('Password changed', {
        userId,
        timestamp: new Date().toISOString()
      });

      return { message: 'Password updated successfully' };
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'changePassword');
    }
  }

  async deactivateUser(userId) {
    try {
      const deactivatedUser = await this.userRepository.deactivateUser(userId);
      
      logger.logSecurity('User deactivated', {
        userId,
        timestamp: new Date().toISOString()
      });

      return deactivatedUser;
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'deactivateUser');
    }
  }

  async activateUser(userId) {
    try {
      const activatedUser = await this.userRepository.activateUser(userId);
      
      logger.logSecurity('User activated', {
        userId,
        timestamp: new Date().toISOString()
      });

      return activatedUser;
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'activateUser');
    }
  }

  async getUsersWithPagination(page = 1, limit = 10, searchTerm = '') {
    try {
      const result = await this.userRepository.findUsersWithPagination(page, limit, searchTerm);
      
      return {
        users: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(result.count / limit),
          totalItems: result.count,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < Math.ceil(result.count / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      throw this.handleError(error, 'getUsersWithPagination');
    }
  }

  async getUserStats() {
    try {
      const totalUsers = await this.userRepository.count();
      const activeUsers = await this.userRepository.count({ isActive: true });
      const adminUsers = await this.userRepository.countUsersByRole('admin');
      
      return {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        adminUsers
      };
    } catch (error) {
      throw this.handleError(error, 'getUserStats');
    }
  }

  generateToken(userId) {
    try {
      return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: '15m' } // Short-lived access token
      );
    } catch (error) {
      throw new Error('Error generating authentication token');
    }
  }

  async refreshAccessToken(refreshTokenValue) {
    try {
      // Find the refresh token
      const refreshToken = await RefreshToken.findOne({
        where: { token: refreshTokenValue },
        include: [{
          model: require('../models/User'),
          as: 'user'
        }]
      });

      if (!refreshToken) {
        throw new Error('Invalid refresh token');
      }

      if (!refreshToken.isValid()) {
        // Clean up invalid token
        await refreshToken.revoke();
        throw new Error('Refresh token has expired or been revoked');
      }

      // Check if user is still active
      const user = refreshToken.user;
      if (!user || !user.isActive) {
        await refreshToken.revoke();
        throw new Error('User account is no longer active');
      }

      // Generate new access token
      const newAccessToken = this.generateToken(user.id);

      // SECURITY: Always rotate refresh token for maximum security
      await refreshToken.revoke();
      const rotatedToken = await RefreshToken.createToken(user.id);
      const newRefreshToken = rotatedToken.token;

      logger.info('Refresh token rotated', {
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      logger.info('Access token refreshed', {
        userId: user.id,
        tokenRotated: true,
        timestamp: new Date().toISOString()
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'refreshAccessToken');
    }
  }

  async revokeRefreshToken(refreshTokenValue) {
    try {
      const refreshToken = await RefreshToken.findOne({
        where: { token: refreshTokenValue }
      });

      if (!refreshToken) {
        throw new Error('Refresh token not found');
      }

      await refreshToken.revoke();

      logger.info('Refresh token revoked', {
        userId: refreshToken.userId,
        timestamp: new Date().toISOString()
      });

      return { message: 'Refresh token revoked successfully' };
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'revokeRefreshToken');
    }
  }

  async revokeAllUserTokens(userId) {
    try {
      const revokedCount = await RefreshToken.revokeAllForUser(userId);

      logger.logSecurity('All refresh tokens revoked for user', {
        userId,
        revokedCount,
        timestamp: new Date().toISOString()
      });

      return { message: `${revokedCount} refresh tokens revoked` };
    } catch (error) {
      logger.logError(error, null);
      throw this.handleError(error, 'revokeAllUserTokens');
    }
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async validateCreateData(userData) {
    const { name, email, password } = userData;

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    if (name.trim().length < 2 || name.trim().length > 50) {
      throw new Error('Name must be between 2 and 50 characters');
    }

    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      throw new Error('Name can only contain letters and spaces');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please provide a valid email address');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    return true;
  }

  async validateUpdateData(updateData) {
    if (updateData.name !== undefined) {
      if (typeof updateData.name !== 'string' || updateData.name.trim().length < 2 || updateData.name.trim().length > 50) {
        throw new Error('Name must be between 2 and 50 characters');
      }

      if (!/^[a-zA-Z\s]+$/.test(updateData.name.trim())) {
        throw new Error('Name can only contain letters and spaces');
      }
    }

    return true;
  }
}

module.exports = UserService;