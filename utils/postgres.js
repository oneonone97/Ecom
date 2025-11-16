/**
 * PostgreSQL Connection Utility using 'postgres' library
 *
 * This provides a direct SQL query interface for Supabase/PostgreSQL.
 * Now used as the primary database interface after removing Sequelize.
 *
 * Usage:
 * const sql = require('./utils/postgres');
 * const users = await sql`SELECT * FROM "Users" LIMIT 10`;
 *
 * Also provides helper functions for common operations.
 */

require('dotenv').config();
const postgres = require('postgres');

// Check if Supabase client should be used instead
// If Supabase is configured, don't initialize direct SQL connection
const useSupabase = !!(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY);

let sql = null;

// Only initialize direct SQL connection if Supabase is NOT configured
if (!useSupabase) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment variables. Either set DATABASE_URL or configure Supabase (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
  }

  // Parse connection string and configure for Supabase
  const connectionString = process.env.DATABASE_URL;
  const isSupabase = connectionString.includes('supabase.co');

  // Configure postgres client
  sql = postgres(connectionString, {
    ssl: isSupabase ? {
      rejectUnauthorized: false // Supabase uses self-signed certificates
    } : 'require',
    max: 10, // Maximum number of connections
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Connection timeout in seconds
    transform: {
      undefined: null // Transform undefined to null for PostgreSQL
    }
  });
} else {
  // When Supabase is configured, create a smart wrapper that:
  // 1. Allows transactions (sql.begin) - creates temporary direct SQL connection
  // 2. Blocks direct queries (sql.unsafe) - use Supabase client instead
  // 3. Blocks template literals (sql`...`) - use Supabase client instead
  
  // Create a function that can be used as a tag function for template literals
  // But throw an error outside of transactions
  const sqlFunction = function(strings, ...values) {
    throw new Error('Template literal SQL queries are disabled outside transactions. Supabase client is configured. Use Supabase client or wrap in sql.begin() for direct SQL.');
  };
  
  sql = Object.assign(sqlFunction, {
    end: async () => {},
    
    // Block direct SQL queries - use Supabase client instead
    unsafe: () => {
      throw new Error('Direct SQL connection is disabled. Supabase client is configured. Use Supabase client instead.');
    },
    
    // Support transactions - create temporary direct SQL connection
    // Transactions require direct SQL as Supabase REST API doesn't support them
    begin: async (callback) => {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required for transactions. Transactions require direct SQL connection.');
      }
      
      const connectionString = process.env.DATABASE_URL;
      const isSupabase = connectionString.includes('supabase.co');
      
      // For Supabase, use pooler URL if available (port 6543 instead of 5432)
      // In serverless environments, direct connections often fail
      let finalConnectionString = connectionString;
      if (isSupabase && 
          connectionString.includes(':5432/') && 
          !connectionString.includes('pooler.supabase.com')) {
        // Convert to pooler URL (port 6543)
        finalConnectionString = connectionString.replace(':5432/', ':6543/');
      }
      
      // Create temporary connection for transaction
      const transactionSql = postgres(finalConnectionString, {
        ssl: isSupabase ? {
          rejectUnauthorized: false
        } : 'require',
        max: 1,
        connect_timeout: 10,
        transform: {
          undefined: null
        }
      });
      
      try {
        // Execute transaction - the callback receives transactionSql which supports template literals
        const result = await transactionSql.begin(callback);
        return result;
      } finally {
        // Always close the transaction connection
        await transactionSql.end();
      }
    }
  });
}

// Note: sql.listen() is for LISTEN/NOTIFY, not for error handling
// Connection errors will be thrown when queries are executed

// Graceful shutdown (only if SQL connection is initialized)
if (sql && !useSupabase) {
  process.on('SIGINT', async () => {
    await sql.end();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await sql.end();
    process.exit(0);
  });
}

// Helper functions for common database operations
const dbHelpers = {
  // Build WHERE clause from object
  buildWhereClause: (conditions, params = []) => {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { where: '', params };
    }

    const clauses = [];
    const values = [...params];

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null || value === undefined) {
        clauses.push(`"${key}" IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${values.length + 1}`).join(', ');
        clauses.push(`"${key}" IN (${placeholders})`);
        values.push(...value);
      } else {
        clauses.push(`"${key}" = $${values.length + 1}`);
        values.push(value);
      }
    }

    return {
      where: `WHERE ${clauses.join(' AND ')}`,
      params: values
    };
  },

  // Build ORDER BY clause
  buildOrderBy: (orderBy) => {
    if (!orderBy) return '';

    if (typeof orderBy === 'string') {
      return `ORDER BY ${orderBy}`;
    }

    if (Array.isArray(orderBy)) {
      const clauses = orderBy.map(clause => {
        if (typeof clause === 'string') return clause;
        if (Array.isArray(clause) && clause.length === 2) {
          return `"${clause[0]}" ${clause[1].toUpperCase()}`;
        }
        return '';
      }).filter(Boolean);

      return clauses.length > 0 ? `ORDER BY ${clauses.join(', ')}` : '';
    }

    return '';
  },

  // Build LIMIT and OFFSET
  buildLimitOffset: (limit, offset) => {
    let sql = '';
    if (limit && limit > 0) {
      sql += ` LIMIT ${parseInt(limit)}`;
    }
    if (offset && offset > 0) {
      sql += ` OFFSET ${parseInt(offset)}`;
    }
    return sql;
  },

  // Execute raw query with optional transaction
  executeQuery: async (query, params = [], transaction = null) => {
    if (transaction) {
      return await transaction.unsafe(query, params);
    }
    return await sql.unsafe(query, params);
  }
};

module.exports = sql;
module.exports.helpers = dbHelpers;

