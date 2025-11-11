/**
 * PostgreSQL Connection Utility using 'postgres' library
 * 
 * This provides a direct SQL query interface for Supabase/PostgreSQL.
 * Use this for raw SQL queries when Sequelize ORM is not needed.
 * 
 * Usage:
 * const sql = require('./utils/postgres');
 * const users = await sql`SELECT * FROM "Users" LIMIT 10`;
 */

require('dotenv').config();
const postgres = require('postgres');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// Parse connection string and configure for Supabase
const connectionString = process.env.DATABASE_URL;
const isSupabase = connectionString.includes('supabase.co');

// Configure postgres client
const sql = postgres(connectionString, {
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

// Note: sql.listen() is for LISTEN/NOTIFY, not for error handling
// Connection errors will be thrown when queries are executed

// Graceful shutdown
process.on('SIGINT', async () => {
  await sql.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await sql.end();
  process.exit(0);
});

module.exports = sql;

