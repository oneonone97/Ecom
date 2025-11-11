const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Ensure dotenv is loaded with correct path

let sequelize = null;

const getSequelize = () => {
  if (!sequelize) {
    const dialect = process.env.DB_DIALECT || 'sqlite';
    const databaseUrl = process.env.DATABASE_URL || 'sqlite::memory:';
    
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
