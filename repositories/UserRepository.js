const BaseRepository = require('./BaseRepository');
const User = require('../models/User');
const { Op } = require('sequelize');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    try {
      return await this.findOne({ email });
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  async findByEmailWithPassword(email) {
    try {
      return await this.model.findOne({
        where: { email },
        attributes: { include: ['password'] }
      });
    } catch (error) {
      throw new Error(`Error finding user by email with password: ${error.message}`);
    }
  }

  async createUser(userData) {
    try {
      return await this.create(userData);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Email already exists');
      }
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async updateUser(userId, updateData) {
    try {
      const result = await this.update({ id: userId }, updateData);
      if (result.updatedRowsCount === 0) {
        throw new Error('User not found');
      }
      return await this.findById(userId);
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  async deleteUser(userId) {
    try {
      const deletedCount = await this.delete({ id: userId });
      if (deletedCount === 0) {
        throw new Error('User not found');
      }
      return true;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  async findUsersWithPagination(page = 1, limit = 10, searchTerm = '') {
    try {
      const offset = (page - 1) * limit;
      const whereCondition = searchTerm ? {
        [Op.or]: [
          { name: { [Op.like]: `%${searchTerm}%` } },
          { email: { [Op.like]: `%${searchTerm}%` } }
        ]
      } : {};

      return await this.findAndCountAll(whereCondition, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password'] }
      });
    } catch (error) {
      throw new Error(`Error finding users with pagination: ${error.message}`);
    }
  }

  async findActiveUsers() {
    try {
      return await this.findAll(
        { isActive: true },
        { 
          attributes: { exclude: ['password'] },
          order: [['lastLoginAt', 'DESC']]
        }
      );
    } catch (error) {
      throw new Error(`Error finding active users: ${error.message}`);
    }
  }

  async countUsersByRole(role) {
    try {
      return await this.count({ role });
    } catch (error) {
      throw new Error(`Error counting users by role: ${error.message}`);
    }
  }

  async updateLastLogin(userId) {
    try {
      return await this.update(
        { id: userId },
        { lastLoginAt: new Date() }
      );
    } catch (error) {
      throw new Error(`Error updating last login: ${error.message}`);
    }
  }

  async findUsersByIds(userIds) {
    try {
      return await this.findAll(
        { id: { [Op.in]: userIds } },
        { attributes: { exclude: ['password'] } }
      );
    } catch (error) {
      throw new Error(`Error finding users by IDs: ${error.message}`);
    }
  }

  async deactivateUser(userId) {
    try {
      return await this.updateUser(userId, { isActive: false });
    } catch (error) {
      throw new Error(`Error deactivating user: ${error.message}`);
    }
  }

  async activateUser(userId) {
    try {
      return await this.updateUser(userId, { isActive: true });
    } catch (error) {
      throw new Error(`Error activating user: ${error.message}`);
    }
  }
}

module.exports = UserRepository;