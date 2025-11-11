const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Ensure dotenv is loaded with correct path

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS || false;

let sequelize = null;

const getSequelize = () => {
  if (!sequelize) {
    const dialect = process.env.DB_DIALECT || 'sqlite';
    const databaseUrl = process.env.DATABASE_URL || 'sqlite::memory:';
    
    // In serverless environments, SQLite won't work (read-only filesystem)
    // Require PostgreSQL for serverless deployments
    if (isServerless) {
      if (dialect === 'sqlite' || databaseUrl.startsWith('sqlite:')) {
        throw new Error(
          'SQLite is not supported in serverless environments (Vercel/Lambda). ' +
          'Please configure PostgreSQL by setting DATABASE_URL to a PostgreSQL connection string. ' +
          'Example: postgresql://user:password@host:5432/database'
        );
      }
      
      if (!databaseUrl || databaseUrl === 'sqlite::memory:') {
        throw new Error(
          'DATABASE_URL is required in serverless environments. ' +
          'Please set DATABASE_URL environment variable to a PostgreSQL connection string.'
        );
      }
      
      // Ensure we're using PostgreSQL
      if (dialect !== 'postgres' && !databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
        console.warn(
          'Warning: DATABASE_URL does not appear to be a PostgreSQL connection string. ' +
          'Serverless environments require PostgreSQL.'
        );
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
