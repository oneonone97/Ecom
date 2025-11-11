const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Ensure dotenv is loaded with correct path

let sequelize = null;

const getSequelize = () => {
  if (!sequelize) {
    const { Sequelize } = require('sequelize');
    
    const dialect = process.env.DB_DIALECT || 'sqlite';
    const databaseUrl = process.env.DATABASE_URL || 'sqlite::memory:';
    
    // Explicitly require pg when using PostgreSQL dialect
    if (dialect === 'postgres' || databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
      try {
        require('pg');
      } catch (error) {
        throw new Error('Please install pg package manually: npm install pg');
      }
    }
    
    sequelize = new Sequelize(
      databaseUrl,
      {
        dialect: dialect,
        logging: false
      }
    );
  }
  return sequelize;
};

module.exports = getSequelize();
// OR export the function
module.exports.getSequelize = getSequelize;
