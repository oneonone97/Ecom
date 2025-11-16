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
      'Orders': ['id', 'userId', 'totalAmount', 'status', 'shippingAddress', 'paymentMethod', 'paymentStatus', 'phonepe_merchant_transaction_id', 'phonepe_transaction_id', 'razorpay_payment_id', 'razorpay_order_id', 'createdAt', 'updatedAt', 'subtotal', 'shippingCost', 'taxAmount', 'billingAddress', 'orderNotes', 'total_amount_paise', 'currency', 'payment_gateway', 'receipt', 'address_json'],
      'OrderItems': ['id', 'orderId', 'productId', 'quantity', 'price_paise', 'productName', 'productImage', 'createdAt', 'updatedAt', 'unit_price_paise', 'productDescription'],
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

      // Handle both formats: { where: {...} } and { key: value }
      const actualConditions = conditions.where || conditions;

      // Build where conditions
      for (const [key, value] of Object.entries(actualConditions)) {
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
      // Handle both: options.where and options as direct conditions
      const whereConditions = options.where || (options.id ? { id: options.id } : {});
      
      if (whereConditions && Object.keys(whereConditions).length > 0) {
        for (const [key, value] of Object.entries(whereConditions)) {
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

      // Order by (also check for orderBy alias)
      const orderOption = options.order || options.orderBy;
      if (orderOption) {
        if (typeof orderOption === 'string') {
          const match = orderOption.trim().match(/^(\w+)\s+(ASC|DESC)$/i);
          if (match) {
            const [, column, direction] = match;
            this.validateColumnName(column);
            query = query.order(column, { ascending: direction.toUpperCase() === 'ASC' });
          }
        } else if (Array.isArray(orderOption)) {
          for (const orderClause of orderOption) {
            if (typeof orderClause === 'string') {
              const match = orderClause.trim().match(/^(\w+)\s+(ASC|DESC)$/i);
              if (match) {
                const [, column, direction] = match;
                this.validateColumnName(column);
                query = query.order(column, { ascending: direction.toUpperCase() === 'ASC' });
              }
            } else if (Array.isArray(orderClause) && orderClause.length === 2) {
              // Handle array format: ['column', 'ASC'] or ['column', 'DESC']
              const [column, direction] = orderClause;
              if (typeof column === 'string' && typeof direction === 'string') {
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

  // Find with relations (complex JOIN queries)
  // Note: Supabase PostgREST doesn't support arbitrary JOINs
  // For complex queries, we fall back to direct SQL
  async findWithRelations(conditions = {}, relations = [], options = {}) {
    try {
      // For complex JOIN queries, Supabase REST API is limited
      // We need to use direct SQL for these cases
      // Create a direct SQL connection for this query only
      const postgres = require('postgres');
      const connectionString = process.env.DATABASE_URL;
      
      if (!connectionString) {
        throw new Error('DATABASE_URL is required for complex JOIN queries');
      }
      
      // For Supabase, use pooler URL if available, otherwise use direct connection
      // In serverless environments, direct connections often fail
      let finalConnectionString = connectionString;
      
      // If it's a Supabase direct connection (port 5432), try to use pooler (port 6543)
      // Only convert if not already using pooler
      if (connectionString.includes('supabase.co')) {
        // Check if it's a direct connection (db.*.supabase.co:5432)
        if (connectionString.includes('db.') && connectionString.includes(':5432/') && 
            !connectionString.includes('pooler.supabase.com')) {
          // Convert to pooler URL format
          // Format: postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
          // Or simpler: change port from 5432 to 6543 and hostname
          const match = connectionString.match(/@db\.([^.]+)\.supabase\.co:5432\//);
          if (match) {
            const projectRef = match[1];
            // Try to extract region from connection string or use default
            // For now, just change port - pooler might work on same hostname with different port
            finalConnectionString = connectionString.replace(':5432/', ':6543/');
            logger.info('Using Supabase pooler for findWithRelations', {
              original: connectionString.substring(0, 60) + '...',
              pooler: finalConnectionString.substring(0, 60) + '...'
            });
          }
        }
      }
      
      // Create a temporary connection for this query
      // Log connection attempt for debugging
      logger.info('Creating direct SQL connection for findWithRelations', {
        usingPooler: finalConnectionString.includes('pooler.supabase.com'),
        port: finalConnectionString.match(/:(\d+)\//)?.[1] || 'unknown',
        hostname: finalConnectionString.match(/@([^:]+):/)?.[1] || 'unknown'
      });
      
      const sql = postgres(finalConnectionString, {
        ssl: finalConnectionString.includes('supabase.co') ? {
          rejectUnauthorized: false
        } : 'require',
        max: 1,
        connect_timeout: 15, // Increased timeout
        idle_timeout: 5, // Close quickly
        transform: {
          undefined: null
        }
      });
      
      // Handle both formats: { where: {...} } and direct conditions
      const actualConditions = conditions.where || conditions;
      
      // Build base query
      const { where, params } = this.buildWhereClauseForSQL(actualConditions);
      const orderBy = this.buildOrderByForSQL(options.order);
      const limitOffset = this.buildLimitOffsetForSQL(options.limit, options.offset);

      // Build JOIN clauses
      const joins = relations.map(rel => {
        if (rel.type === 'LEFT_JOIN') {
          return `LEFT JOIN "${rel.table}" ON "${this.tableName}"."${rel.localKey}" = "${rel.table}"."${rel.foreignKey}"`;
        }
        if (rel.type === 'INNER_JOIN') {
          return `INNER JOIN "${rel.table}" ON "${this.tableName}"."${rel.localKey}" = "${rel.table}"."${rel.foreignKey}"`;
        }
        return '';
      }).filter(Boolean).join(' ');

      const orderByClause = orderBy ? `ORDER BY ${orderBy}` : '';
      const query = `SELECT * FROM "${this.tableName}" ${joins} ${where} ${orderByClause} ${limitOffset.sql}`;
      
      const result = await sql.unsafe(query, [...params, ...limitOffset.params]);
      
      // Close the temporary connection
      await sql.end();
      
      return result;
    } catch (error) {
      logger.error(`Error in findWithRelations for ${this.tableName}:`, error);
      
      // If it's a connection error, provide helpful message
      if (error.message && error.message.includes('Tenant or user not found')) {
        const isPooler = connectionString?.includes('pooler.supabase.com');
        logger.error('Direct SQL connection failed with "Tenant or user not found"', {
          error: error.message,
          usingPooler: isPooler,
          connectionString: connectionString ? `${connectionString.substring(0, 50)}...` : 'not set',
          suggestion: isPooler 
            ? 'Pooler URL is correct but connection failed. Check: 1) Pooler is enabled in Supabase Dashboard, 2) Password is correct and URL-encoded, 3) Project is active'
            : 'Ensure DATABASE_URL uses pooler URL (port 6543) or connection pooler is enabled'
        });
        
        // Provide a more helpful error message
        throw new Error(`Database connection failed: ${isPooler ? 'Pooler connection failed. Please verify pooler is enabled in Supabase Dashboard → Settings → Database → Connection Pooling' : 'Use pooler URL (port 6543) instead of direct connection (port 5432)'}`);
      }
      
      throw error;
    }
  }

  // Helper methods for SQL building (used by findWithRelations)
  buildWhereClauseForSQL(conditions = {}) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { where: '', params: [] };
    }

    const clauses = [];
    const params = [];

    for (const [key, value] of Object.entries(conditions)) {
      this.validateColumnName(key);

      if (value === null || value === undefined) {
        clauses.push(`"${key}" IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${params.length + 1}`).join(', ');
        clauses.push(`"${key}" IN (${placeholders})`);
        params.push(...value);
      } else {
        clauses.push(`"${key}" = $${params.length + 1}`);
        params.push(value);
      }
    }

    return {
      where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params
    };
  }

  buildOrderByForSQL(orderBy) {
    if (!orderBy) return '';

    if (typeof orderBy === 'string') {
      const match = orderBy.trim().match(/^(\w+)\s+(ASC|DESC)$/i);
      if (match) {
        const [, column, direction] = match;
        this.validateColumnName(column);
        return `"${column}" ${direction.toUpperCase()}`;
      }
    }

    if (Array.isArray(orderBy)) {
      const clauses = orderBy.map(clause => {
        if (typeof clause === 'string') {
          const match = clause.trim().match(/^(\w+)\s+(ASC|DESC)$/i);
          if (match) {
            const [, column, direction] = match;
            this.validateColumnName(column);
            return `"${column}" ${direction.toUpperCase()}`;
          }
        }
        return '';
      }).filter(Boolean);

      return clauses.length > 0 ? clauses.join(', ') : '';
    }

    return '';
  }

  buildLimitOffsetForSQL(limit, offset) {
    const parts = [];
    const params = [];

    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || !isFinite(limitNum) || limitNum < 0 || limitNum > 10000) {
        throw new Error('Invalid limit value');
      }
      parts.push(`LIMIT $${params.length + 1}`);
      params.push(limitNum);
    }

    if (offset) {
      const offsetNum = parseInt(offset);
      if (isNaN(offsetNum) || !isFinite(offsetNum) || offsetNum < 0) {
        throw new Error('Invalid offset value');
      }
      parts.push(`OFFSET $${params.length + 1}`);
      params.push(offsetNum);
    }

    return { sql: parts.join(' '), params };
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

  // Bulk update
  async bulkUpdate(updates) {
    try {
      if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error('Updates array must be non-empty');
      }

      // For complex CASE-based bulk updates, use direct SQL
      // Supabase REST API doesn't support complex CASE statements
      const postgres = require('postgres');
      const connectionString = process.env.DATABASE_URL;
      
      if (!connectionString) {
        throw new Error('DATABASE_URL is required for bulk update operations');
      }

      // For Supabase, use pooler URL if available
      let finalConnectionString = connectionString;
      if (connectionString.includes('supabase.co') && 
          connectionString.includes(':5432/') && 
          !connectionString.includes('pooler.supabase.com')) {
        finalConnectionString = connectionString.replace(':5432/', ':6543/');
      }
      
      // Create temporary connection for bulk update
      const sql = postgres(finalConnectionString, {
        ssl: finalConnectionString.includes('supabase.co') ? {
          rejectUnauthorized: false
        } : 'require',
        max: 1,
        connect_timeout: 10
      });

      // Each update should have { id, data: {...} }
      const cases = {};
      const params = [];

      for (const update of updates) {
        if (!update.id || !update.data) {
          throw new Error('Each update must have id and data properties');
        }

        // Validate column names
        const validData = {};
        for (const [key, value] of Object.entries(update.data)) {
          if (this.allowedColumns.includes(key)) {
            validData[key] = value;
          }
        }

        if (Object.keys(validData).length === 0) {
          throw new Error('No valid columns to update');
        }

        // Build CASE statements
        for (const [column, value] of Object.entries(validData)) {
          if (!cases[column]) cases[column] = [];
          cases[column].push(`WHEN "${this.primaryKey}" = $${params.length + 1} THEN $${params.length + 2}`);
          params.push(update.id, value);
        }
      }

      // Build query
      const setClauses = Object.entries(cases).map(([column, whenClauses]) =>
        `"${column}" = CASE ${whenClauses.join(' ')} END`
      );

      const ids = updates.map(u => u.id);
      const idPlaceholders = ids.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...ids);

      const query = `
        UPDATE "${this.tableName}"
        SET ${setClauses.join(', ')}, "updatedAt" = NOW()
        WHERE "${this.primaryKey}" IN (${idPlaceholders})
        RETURNING *
      `;

      const result = await sql.unsafe(query, params);
      
      // Close the temporary connection
      await sql.end();
      
      return result;
    } catch (error) {
      logger.error(`Error in bulkUpdate for ${this.tableName}:`, error);
      throw error;
    }
  }

  // Aggregate queries
  async aggregate(options = {}) {
    try {
      // For complex aggregations, use direct SQL
      // Supabase REST API has limitations with complex GROUP BY and HAVING
      const postgres = require('postgres');
      const connectionString = process.env.DATABASE_URL;
      
      if (!connectionString) {
        throw new Error('DATABASE_URL is required for aggregate operations');
      }

      // For Supabase, use pooler URL if available
      let finalConnectionString = connectionString;
      if (connectionString.includes('supabase.co') && 
          connectionString.includes(':5432/') && 
          !connectionString.includes('pooler.supabase.com')) {
        finalConnectionString = connectionString.replace(':5432/', ':6543/');
      }
      
      // Create temporary connection for aggregate query
      const sql = postgres(finalConnectionString, {
        ssl: finalConnectionString.includes('supabase.co') ? {
          rejectUnauthorized: false
        } : 'require',
        max: 1,
        connect_timeout: 10
      });

      const { groupBy, having } = options;
      const { where, params } = this.buildWhereClauseForSQL(options.where || {});

      // Validate groupBy columns
      if (groupBy) {
        if (Array.isArray(groupBy)) {
          groupBy.forEach(col => this.validateColumnName(col));
        } else {
          this.validateColumnName(groupBy);
        }
      }

      // Build aggregation query
      let selectClause = '*';
      if (options.functions) {
        const functions = [];
        for (const [alias, func] of Object.entries(options.functions)) {
          // Parse function like "COUNT(*)", "SUM(price)", etc.
          const match = func.match(/^(\w+)\(([^)]+)\)$/);
          if (match) {
            const [, funcName, column] = match;
            if (column !== '*') {
              this.validateColumnName(column);
              // Quote column name for PostgreSQL case sensitivity
              functions.push(`${funcName}("${column}") as ${alias}`);
            } else {
              functions.push(`${funcName}(${column}) as ${alias}`);
            }
          }
        }
        if (functions.length > 0) {
          selectClause = functions.join(', ');
        }
      }

      let query = `SELECT ${selectClause} FROM "${this.tableName}" ${where}`;

      if (groupBy) {
        const groupCols = Array.isArray(groupBy) ? groupBy : [groupBy];
        query += ` GROUP BY ${groupCols.map(col => `"${col}"`).join(', ')}`;
      }

      if (having) {
        // Simple having clause
        query += ` HAVING ${having}`;
      }

      const result = await sql.unsafe(query, params);
      
      // Close the temporary connection
      await sql.end();
      
      return result;
    } catch (error) {
      logger.error(`Error in aggregate for ${this.tableName}:`, error);
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
