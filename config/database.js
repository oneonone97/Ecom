const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Ensure dotenv is loaded with correct path

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS || false;

let sequelize = null;

const getSequelize = () => {
  if (!sequelize) {
    // In serverless environments, SQLite won't work (read-only filesystem)
    // Require PostgreSQL for serverless deployments - check this FIRST before setting defaults
    if (isServerless) {
      // In serverless, DATABASE_URL is required and must be PostgreSQL
      if (!process.env.DATABASE_URL) {
        throw new Error(
          'DATABASE_URL is required in serverless environments (Vercel/Lambda). ' +
          'Please set DATABASE_URL environment variable to a PostgreSQL connection string. ' +
          'Example: postgresql://user:password@host:5432/database'
        );
      }
      
      // Check if trying to use SQLite in serverless
      if (process.env.DATABASE_URL.startsWith('sqlite:') || process.env.DB_DIALECT === 'sqlite') {
        throw new Error(
          'SQLite is not supported in serverless environments (Vercel/Lambda). ' +
          'Please configure PostgreSQL by setting DATABASE_URL to a PostgreSQL connection string. ' +
          'Example: postgresql://user:password@host:5432/database'
        );
      }
      
      // Ensure we're using PostgreSQL
      if (!process.env.DATABASE_URL.startsWith('postgres://') && !process.env.DATABASE_URL.startsWith('postgresql://')) {
        throw new Error(
          'DATABASE_URL must be a PostgreSQL connection string in serverless environments. ' +
          'Current value does not appear to be PostgreSQL. ' +
          'Example: postgresql://user:password@host:5432/database'
        );
      }
    }
    
    // Set defaults only for non-serverless environments
    const databaseUrl = process.env.DATABASE_URL || (isServerless ? null : 'sqlite::memory:');
    
    // Final check - if we still don't have a database URL, throw error
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required. Please set DATABASE_URL environment variable.'
      );
    }
    
    // Auto-detect dialect from DATABASE_URL if not explicitly set
    let dialect = process.env.DB_DIALECT;
    if (!dialect) {
      if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
        dialect = 'postgres';
      } else if (databaseUrl.startsWith('sqlite:')) {
        dialect = 'sqlite';
      } else if (isServerless) {
        // In serverless, default to postgres if we can't detect
        dialect = 'postgres';
      } else {
        // In non-serverless, default to sqlite
        dialect = 'sqlite';
      }
    }
    
    const { Sequelize } = require('sequelize');
    
    // Build sequelize config
    const sequelizeConfig = {
      dialect: dialect,
      logging: false
    };
    
    // Explicitly require and set pg as dialectModule when using PostgreSQL
    // This ensures Sequelize uses the pg module even in serverless environments
    if (dialect === 'postgres' || databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
      try {
        const pg = require('pg');
        sequelizeConfig.dialectModule = pg;
        
        // Also set dialectOptions for SSL if needed (for Supabase, etc.)
        if (databaseUrl.includes('supabase.co') || process.env.DB_SSL === 'true') {
          sequelizeConfig.dialectOptions = {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          };
        }
      } catch (error) {
        console.error('Failed to load pg module:', error);
        throw new Error('Please install pg package manually: npm install pg. Error: ' + error.message);
      }
    } else if (isServerless) {
      // If we're in serverless and not using PostgreSQL, this is an error
      throw new Error(
        'PostgreSQL is required in serverless environments. ' +
        'Please configure DATABASE_URL with a PostgreSQL connection string.'
      );
    }
    
    sequelize = new Sequelize(
      databaseUrl,
      sequelizeConfig
    );
  }
  return sequelize;
};

module.exports = getSequelize();
// OR export the function
module.exports.getSequelize = getSequelize;
