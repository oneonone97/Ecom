class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, options = {}) {
    try {
      return await this.model.findByPk(id, options);
    } catch (error) {
      throw new Error(`Error finding ${this.model.name} by ID: ${error.message}`);
    }
  }

  async findOne(conditions, options = {}) {
    try {
      return await this.model.findOne({
        where: conditions,
        ...options
      });
    } catch (error) {
      throw new Error(`Error finding ${this.model.name}: ${error.message}`);
    }
  }

  async findAll(conditions = {}, options = {}) {
    try {
      return await this.model.findAll({
        where: conditions,
        ...options
      });
    } catch (error) {
      throw new Error(`Error finding all ${this.model.name}: ${error.message}`);
    }
  }

  async findAndCountAll(conditions = {}, options = {}) {
    try {
      return await this.model.findAndCountAll({
        where: conditions,
        ...options
      });
    } catch (error) {
      throw new Error(`Error finding and counting ${this.model.name}: ${error.message}`);
    }
  }

  async create(data, options = {}) {
    try {
      return await this.model.create(data, options);
    } catch (error) {
      throw new Error(`Error creating ${this.model.name}: ${error.message}`);
    }
  }

  async update(conditions, data, options = {}) {
    try {
      const [updatedRowsCount, updatedRows] = await this.model.update(data, {
        where: conditions,
        returning: true,
        ...options
      });
      return { updatedRowsCount, updatedRows };
    } catch (error) {
      throw new Error(`Error updating ${this.model.name}: ${error.message}`);
    }
  }

  async delete(conditions, options = {}) {
    try {
      return await this.model.destroy({
        where: conditions,
        ...options
      });
    } catch (error) {
      throw new Error(`Error deleting ${this.model.name}: ${error.message}`);
    }
  }

  async findOrCreate(conditions, defaults, options = {}) {
    try {
      return await this.model.findOrCreate({
        where: conditions,
        defaults,
        ...options
      });
    } catch (error) {
      throw new Error(`Error finding or creating ${this.model.name}: ${error.message}`);
    }
  }

  async count(conditions = {}, options = {}) {
    try {
      return await this.model.count({
        where: conditions,
        ...options
      });
    } catch (error) {
      throw new Error(`Error counting ${this.model.name}: ${error.message}`);
    }
  }

  async bulkCreate(data, options = {}) {
    try {
      return await this.model.bulkCreate(data, options);
    } catch (error) {
      throw new Error(`Error bulk creating ${this.model.name}: ${error.message}`);
    }
  }

  async executeInTransaction(callback, transaction = null) {
    const sequelize = this.model.sequelize;
    
    if (transaction) {
      return await callback(transaction);
    }

    const newTransaction = await sequelize.transaction();
    try {
      const result = await callback(newTransaction);
      await newTransaction.commit();
      return result;
    } catch (error) {
      await newTransaction.rollback();
      throw error;
    }
  }
}

module.exports = BaseRepository;