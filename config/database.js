const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Ensure dotenv is loaded with correct path

let sequelize;

// Check if we're using SQLite for development
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:')) {
  const sqlitePath = process.env.DATABASE_URL.replace('sqlite:', '');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
} else if (process.env.DATABASE_URL) {
  // PostgreSQL configuration for production/Supabase
  const isSupabase = process.env.DATABASE_URL.includes('supabase.co');
  
  // Remove sslmode from URL if present (we'll handle SSL via dialectOptions)
  let databaseUrl = process.env.DATABASE_URL;
  databaseUrl = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');
  
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: isSupabase ? {
        require: true,
        rejectUnauthorized: false // Supabase uses self-signed certificates
      } : {
        require: true,
        rejectUnauthorized: true
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // Fallback to SQLite for development if no DATABASE_URL is provided
  console.log('No DATABASE_URL found, using SQLite for development');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
}

module.exports = sequelize;
