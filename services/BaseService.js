class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  async findById(id, options = {}) {
    try {
      const entity = await this.repository.findById(id, options);
      if (!entity) {
        throw new Error(`${this.getEntityName()} not found`);
      }
      return entity;
    } catch (error) {
      throw this.handleError(error, 'findById');
    }
  }

  async findAll(conditions = {}, options = {}) {
    try {
      return await this.repository.findAll(conditions, options);
    } catch (error) {
      throw this.handleError(error, 'findAll');
    }
  }

  async create(data) {
    try {
      await this.validateCreateData(data);
      return await this.repository.create(data);
    } catch (error) {
      throw this.handleError(error, 'create');
    }
  }

  async update(id, data) {
    try {
      await this.validateUpdateData(data);
      const entity = await this.repository.findById(id);
      if (!entity) {
        throw new Error(`${this.getEntityName()} not found`);
      }
      return await this.repository.updateEntity(id, data);
    } catch (error) {
      throw this.handleError(error, 'update');
    }
  }

  async delete(id) {
    try {
      const entity = await this.repository.findById(id);
      if (!entity) {
        throw new Error(`${this.getEntityName()} not found`);
      }
      return await this.repository.deleteEntity(id);
    } catch (error) {
      throw this.handleError(error, 'delete');
    }
  }

  async validateCreateData(data) {
    // Override in child classes for specific validation
    return true;
  }

  async validateUpdateData(data) {
    // Override in child classes for specific validation
    return true;
  }

  getEntityName() {
    return this.constructor.name.replace('Service', '');
  }

  handleError(error, operation) {
    const entityName = this.getEntityName();
    
    // Log error details
    console.error(`${entityName}Service.${operation} Error:`, error);
    
    // Return user-friendly error messages
    if (error.message.includes('not found')) {
      return new Error(`${entityName} not found`);
    }
    
    if (error.message.includes('already exists')) {
      return new Error(`${entityName} already exists`);
    }
    
    if (error.message.includes('validation')) {
      return new Error(`Invalid ${entityName.toLowerCase()} data: ${error.message}`);
    }
    
    // Return original error for unexpected cases
    return error;
  }

  async executeWithTransaction(callback) {
    try {
      return await this.repository.executeInTransaction(callback);
    } catch (error) {
      throw this.handleError(error, 'transaction');
    }
  }

  formatResponse(data, message = 'Operation successful') {
    return {
      success: true,
      message,
      data
    };
  }

  formatError(error, statusCode = 500) {
    return {
      success: false,
      message: error.message,
      statusCode,
      timestamp: new Date().toISOString()
    };
  }

  async paginate(page = 1, limit = 10, conditions = {}, options = {}) {
    try {
      const offset = (page - 1) * limit;
      const result = await this.repository.findAndCountAll(conditions, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        ...options
      });

      return {
        data: result.rows,
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
      throw this.handleError(error, 'paginate');
    }
  }
}

module.exports = BaseService;