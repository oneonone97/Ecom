const sql = require('./postgres');

/**
 * Simple Database Access Layer (replacing Sequelize models)
 * Provides basic CRUD operations for all tables with SQL injection protection
 */
class Database {
  constructor(tableName, primaryKey = 'id', allowedColumns = []) {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.allowedColumns = allowedColumns || this.getDefaultColumns();
  }

  // Default column whitelists for each table
  getDefaultColumns() {
    const defaults = {
      'Users': ['id', 'username', 'email', 'password', 'firstName', 'lastName', 'phone', 'avatar', 'isActive', 'isVerified', 'role', 'lastLogin', 'loginAttempts', 'lockUntil', 'emailVerificationToken', 'emailVerificationExpires', 'passwordResetToken', 'passwordResetExpires', 'createdAt', 'updatedAt'],
      'Products': ['id', 'name', 'description', 'price_paise', 'stock', 'categoryId', 'imageUrl', 'isActive', 'weight_grams', 'dimensions', 'sku', 'tags', 'createdAt', 'updatedAt'],
      'Categories': ['id', 'name', 'description', 'imageUrl', 'isActive', 'parentId', 'createdAt', 'updatedAt'],
      'Carts': ['id', 'userId', 'createdAt', 'updatedAt'],
      'CartItems': ['id', 'cartId', 'productId', 'quantity', 'price_paise', 'createdAt', 'updatedAt'],
      'Orders': ['id', 'userId', 'totalAmount', 'status', 'shippingAddress', 'paymentMethod', 'paymentStatus', 'phonepe_merchant_transaction_id', 'phonepe_transaction_id', 'razorpay_payment_id', 'razorpay_order_id', 'createdAt', 'updatedAt'],
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

  // Sanitize ORDER BY clause
  sanitizeOrderBy(orderBy) {
    if (!orderBy) return '';

    if (typeof orderBy === 'string') {
      // Parse "columnName ASC" or "columnName DESC"
      const match = orderBy.trim().match(/^(\w+)\s+(ASC|DESC)$/i);
      if (!match) {
        throw new Error('Invalid ORDER BY format. Use: columnName ASC/DESC');
      }
      const [, columnName, direction] = match;
      this.validateColumnName(columnName);
      return `"${columnName}" ${direction.toUpperCase()}`;
    }

    if (Array.isArray(orderBy)) {
      const clauses = orderBy.map(clause => {
        if (typeof clause === 'string') {
          return this.sanitizeOrderBy(clause);
        }
        if (Array.isArray(clause) && clause.length === 2) {
          const [columnName, direction] = clause;
          this.validateColumnName(columnName);
          const dir = String(direction).toUpperCase();
          if (!['ASC', 'DESC'].includes(dir)) {
            throw new Error(`Invalid sort direction: ${direction}`);
          }
          return `"${columnName}" ${dir}`;
        }
        return '';
      }).filter(Boolean);

      return clauses.length > 0 ? clauses.join(', ') : '';
    }

    return '';
  }

  // Find by primary key
  async findByPk(id) {
    const result = await sql`
      SELECT * FROM "${this.tableName}" WHERE "${this.primaryKey}" = ${id}
    `;
    return result[0] || null;
  }

  // Find one record
  async findOne(conditions = {}) {
    const { where, params } = this.buildWhereClause(conditions);
    const query = `SELECT * FROM "${this.tableName}" ${where} LIMIT 1`;
    const result = await sql.unsafe(query, params);
    return result[0] || null;
  }

  // Find all records
  async findAll(options = {}) {
    const { where, params } = this.buildWhereClause(options.where);
    const orderBy = this.buildOrderBy(options.order);
    const limitOffsetData = this.buildLimitOffset(options.limit, options.offset);

    const orderByClause = orderBy ? `ORDER BY ${orderBy}` : '';
    const query = `SELECT * FROM "${this.tableName}" ${where} ${orderByClause} ${limitOffsetData.sql}`;
    const result = await sql.unsafe(query, [...params, ...limitOffsetData.params]);
    return result;
  }

  // Create new record
  async create(data) {
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

    const columns = Object.keys(validData);
    const values = Object.values(validData);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO "${this.tableName}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await sql.unsafe(query, values);
    return result[0];
  }

  // Update record
  async update(id, data) {
    // Validate and filter column names
    const validData = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.allowedColumns.includes(key)) {
        validData[key] = value;
      }
    }

    if (Object.keys(validData).length === 0) return null;

    const setClause = Object.keys(validData).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    const values = Object.values(validData);

    const query = `
      UPDATE "${this.tableName}"
      SET ${setClause}, "updatedAt" = NOW()
      WHERE "${this.primaryKey}" = $${values.length + 1}
      RETURNING *
    `;

    const result = await sql.unsafe(query, [...values, id]);
    return result[0] || null;
  }

  // Delete record
  async destroy(id) {
    const result = await sql`
      DELETE FROM "${this.tableName}" WHERE "${this.primaryKey}" = ${id}
      RETURNING "${this.primaryKey}"
    `;
    return result.length > 0;
  }

  // Count records
  async count(conditions = {}) {
    const { where, params } = this.buildWhereClause(conditions);
    const query = `SELECT COUNT(*) as count FROM "${this.tableName}" ${where}`;
    const result = await sql.unsafe(query, params);
    return parseInt(result[0].count);
  }

  // Transaction support
  async beginTransaction() {
    return await sql.begin(async (transaction) => {
      return transaction;
    });
  }

  // Specialized query methods
  async findWithRelations(conditions = {}, relations = [], options = {}) {
    // Build base query
    const { where, params } = this.buildWhereClause(conditions.where || conditions);
    const orderBy = this.sanitizeOrderBy(options.order);
    const limitOffset = this.buildLimitOffset(options.limit, options.offset);

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

    const limitOffsetData = this.buildLimitOffset(options.limit, options.offset);
    const orderByClause = orderBy ? `ORDER BY ${orderBy}` : '';
    const query = `SELECT * FROM "${this.tableName}" ${joins} ${where} ${orderByClause} ${limitOffsetData.sql}`;
    return await sql.unsafe(query, [...params, ...limitOffsetData.params]);
  }

  async bulkCreate(dataArray) {
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

    // Validate column names
    const columns = firstKeys.filter(col => this.allowedColumns.includes(col));
    if (columns.length === 0) {
      throw new Error('No valid columns found');
    }

    // Build bulk insert
    const values = [];
    const placeholders = [];

    for (let i = 0; i < dataArray.length; i++) {
      const data = dataArray[i];
      const rowValues = columns.map(col => data[col]);
      values.push(...rowValues);
      const rowPlaceholders = columns.map((_, j) => `$${values.length - rowValues.length + j + 1}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const query = `
      INSERT INTO "${this.tableName}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    return await sql.unsafe(query, values);
  }

  async bulkUpdate(updates) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Updates array must be non-empty');
    }

    // Each update should have { id, data: {...} }
    const cases = [];
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

    return await sql.unsafe(query, params);
  }

  async aggregate(options = {}) {
    const { groupBy, having } = options;
    const { where, params } = this.buildWhereClause(options.where || {});

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
          }
          functions.push(`${funcName}(${column}) as ${alias}`);
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
      // Simple having clause - could be enhanced
      query += ` HAVING ${having}`;
    }

    return await sql.unsafe(query, params);
  }

  // Helper methods (secure versions)
  buildWhereClause(conditions = {}) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { where: '', params: [] };
    }

    const clauses = [];
    const params = [];

    for (const [key, value] of Object.entries(conditions)) {
      // CRITICAL: Validate column name against whitelist
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

  buildOrderBy(orderBy) {
    return this.sanitizeOrderBy(orderBy);
  }

  buildLimitOffset(limit, offset) {
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
}

// Create instances for each table
const db = {
  users: new Database('Users'),
  products: new Database('Products'),
  categories: new Database('Categories'),
  carts: new Database('Carts'),
  cartItems: new Database('CartItems'),
  orders: new Database('Orders'),
  orderItems: new Database('OrderItems'),
  reviews: new Database('Reviews'),
  wishlists: new Database('Wishlists'),
  wishlistItems: new Database('WishlistItems'),
  refreshTokens: new Database('RefreshTokens'),
};

module.exports = db;
