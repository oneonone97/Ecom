/**
 * Supabase Database Adapter
 * 
 * This adapter uses Supabase client (PostgREST API) instead of direct SQL,
 * which provides automatic connection pooling and better reliability in
 * serverless environments.
 * 
 * Maintains the same interface as utils/database.js for backward compatibility.
 */

const { getSupabaseClient } = require('../config/supabase');
const logger = require('./logger');

/**
 * Supabase Database Adapter Class
 * Provides same interface as Database class but uses Supabase client
 */
class SupabaseDatabase {
  constructor(tableName, primaryKey = 'id', allowedColumns = null) {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.allowedColumns = (allowedColumns && allowedColumns.length > 0) 
      ? allowedColumns 
      : this.getDefaultColumns();
  }

  // Default column whitelists for each table (same as Database class)
  getDefaultColumns() {
    const defaults = {
      'Users': ['id', 'name', 'email', 'password', 'role', 'isActive', 'lastLoginAt', 'loginAttempts', 'lockUntil', 'createdAt', 'updatedAt', 'firstName', 'lastName', 'phone', 'isVerified', 'username'],
      'Products': ['id', 'name', 'description', 'price_paise', 'sale_price_paise', 'stock', 'categoryId', 'image_url', 'featured', 'is_new', 'is_sale', 'createdAt', 'updatedAt', 'sku'],
      'Categories': ['id', 'name', 'slug', 'description', 'parentId', 'image', 'isActive', 'sortOrder', 'productCount', 'metaTitle', 'metaDescription', 'metaKeywords', 'createdAt', 'updatedAt'],
      'Carts': ['id', 'userId', 'createdAt', 'updatedAt'],
      'CartItems': ['id', 'cartId', 'productId', 'quantity', 'price_paise', 'createdAt', 'updatedAt'],
      'Orders': ['id', 'userId', 'totalAmount', 'status', 'shippingAddress', 'paymentMethod', 'paymentStatus', 'phonepe_merchant_transaction_id', 'phonepe_transaction_id', 'razorpay_payment_id', 'razorpay_order_id', 'createdAt', 'updatedAt', 'subtotal', 'shippingCost', 'taxAmount', 'billingAddress', 'orderNotes'],
      'OrderItems': ['id', 'orderId', 'productId', 'quantity', 'price_paise', 'productName', 'productImage', 'createdAt', 'updatedAt'],
      'Reviews': ['id', 'userId', 'productId', 'rating', 'title', 'comment', 'isVerified', 'createdAt', 'updatedAt'],
      'Wishlists': ['id', 'userId', 'name', 'createdAt', 'updatedAt'],
      'WishlistItems': ['id', 'wishlistId', 'productId', 'createdAt', 'updatedAt'],
      'RefreshTokens': ['id', 'userId', 'token', 'expiresAt', 'createdAt', 'updatedAt']
    };
    return defaults[this.tableName] || [];
  }

  // Validate column name against whitelist
  validateColumnName(columnName) {
    if (!this.allowedColumns.includes(columnName)) {
      throw new Error(`Invalid column name: ${columnName}`);
    }
    return true;
  }

  // Get Supabase client
  getClient() {
    return getSupabaseClient();
  }

  // Find by primary key
  async findByPk(id) {
    try {
      const { data, error } = await this.getClient()
        .from(this.tableName)
        .select('*')
        .eq(this.primaryKey, id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(`Error in findByPk for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Find one record
  async findOne(conditions = {}) {
    try {
      let query = this.getClient().from(this.tableName).select('*');

      // Build where conditions
      for (const [key, value] of Object.entries(conditions)) {
        this.validateColumnName(key);
        
        if (value === null || value === undefined) {
          query = query.is(key, null);
        } else if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data || null;
    } catch (error) {
      logger.error(`Error in findOne for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Find all records
  async findAll(options = {}) {
    try {
      let query = this.getClient().from(this.tableName).select('*');

      // Build where conditions
      if (options.where) {
        for (const [key, value] of Object.entries(options.where)) {
          this.validateColumnName(key);
          
          if (value === null || value === undefined) {
            query = query.is(key, null);
          } else if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      }

      // Order by
      if (options.order) {
        if (typeof options.order === 'string') {
          const match = options.order.trim().match(/^(\w+)\s+(ASC|DESC)$/i);
          if (match) {
            const [, column, direction] = match;
            this.validateColumnName(column);
            query = query.order(column, { ascending: direction.toUpperCase() === 'ASC' });
          }
        } else if (Array.isArray(options.order)) {
          for (const orderClause of options.order) {
            if (typeof orderClause === 'string') {
              const match = orderClause.trim().match(/^(\w+)\s+(ASC|DESC)$/i);
              if (match) {
                const [, column, direction] = match;
                this.validateColumnName(column);
                query = query.order(column, { ascending: direction.toUpperCase() === 'ASC' });
              }
            }
          }
        }
      }

      // Limit and offset
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error(`Error in findAll for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Create new record
  async create(data) {
    try {
      // Validate and filter column names
      const validData = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.allowedColumns.includes(key)) {
          validData[key] = value;
        }
      }

      if (Object.keys(validData).length === 0) {
        throw new Error('No valid columns found in data');
      }

      // Add timestamps
      const now = new Date().toISOString();
      if (this.allowedColumns.includes('createdAt') && !validData.createdAt) {
        validData.createdAt = now;
      }
      if (this.allowedColumns.includes('updatedAt') && !validData.updatedAt) {
        validData.updatedAt = now;
      }

      const { data: result, error } = await this.getClient()
        .from(this.tableName)
        .insert(validData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return result;
    } catch (error) {
      logger.error(`Error in create for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Update record
  async update(id, data) {
    try {
      // Validate and filter column names
      const validData = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.allowedColumns.includes(key)) {
          validData[key] = value;
        }
      }

      if (Object.keys(validData).length === 0) {
        return null;
      }

      // Add updatedAt timestamp
      if (this.allowedColumns.includes('updatedAt')) {
        validData.updatedAt = new Date().toISOString();
      }

      const { data: result, error } = await this.getClient()
        .from(this.tableName)
        .update(validData)
        .eq(this.primaryKey, id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return result;
    } catch (error) {
      logger.error(`Error in update for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Delete record
  async destroy(id) {
    try {
      const { error } = await this.getClient()
        .from(this.tableName)
        .delete()
        .eq(this.primaryKey, id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      logger.error(`Error in destroy for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Count records
  async count(conditions = {}) {
    try {
      let query = this.getClient().from(this.tableName).select('*', { count: 'exact', head: true });

      // Build where conditions
      for (const [key, value] of Object.entries(conditions)) {
        this.validateColumnName(key);
        
        if (value === null || value === undefined) {
          query = query.is(key, null);
        } else if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error(`Error in count for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Bulk create
  async bulkCreate(dataArray) {
    try {
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        throw new Error('Data array must be non-empty');
      }

      // Validate all data objects have same columns
      const firstKeys = Object.keys(dataArray[0]).sort();
      for (const data of dataArray) {
        const keys = Object.keys(data).sort();
        if (JSON.stringify(keys) !== JSON.stringify(firstKeys)) {
          throw new Error('All objects must have identical column structure');
        }
      }

      // Validate and filter column names
      const validDataArray = dataArray.map(data => {
        const validData = {};
        for (const [key, value] of Object.entries(data)) {
          if (this.allowedColumns.includes(key)) {
            validData[key] = value;
          }
        }
        
        // Add timestamps
        const now = new Date().toISOString();
        if (this.allowedColumns.includes('createdAt') && !validData.createdAt) {
          validData.createdAt = now;
        }
        if (this.allowedColumns.includes('updatedAt') && !validData.updatedAt) {
          validData.updatedAt = now;
        }
        
        return validData;
      });

      const { data, error } = await this.getClient()
        .from(this.tableName)
        .insert(validDataArray)
        .select();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(`Error in bulkCreate for ${this.tableName}:`, error);
      throw error;
    }
  }
}

// Create instances for each table (same interface as utils/database.js)
const db = {
  users: new SupabaseDatabase('Users'),
  products: new SupabaseDatabase('Products'),
  categories: new SupabaseDatabase('Categories'),
  carts: new SupabaseDatabase('Carts'),
  cartItems: new SupabaseDatabase('CartItems'),
  orders: new SupabaseDatabase('Orders'),
  orderItems: new SupabaseDatabase('OrderItems'),
  reviews: new SupabaseDatabase('Reviews'),
  wishlists: new SupabaseDatabase('Wishlists'),
  wishlistItems: new SupabaseDatabase('WishlistItems'),
  refreshTokens: new SupabaseDatabase('RefreshTokens'),
};

module.exports = db;
