/**
 * Data Migration Script: SQLite to Supabase (PostgreSQL)
 * 
 * This script migrates data from SQLite database to Supabase PostgreSQL database.
 * 
 * Prerequisites:
 * 1. SQLite database must exist (database.sqlite or database/myshop.sqlite)
 * 2. Supabase DATABASE_URL must be set in .env file
 * 3. All tables must be created in Supabase (run migrations first)
 * 
 * Usage:
 * node scripts/migrate-data-to-supabase.js
 * 
 * WARNING: This script will INSERT data into Supabase. Make sure:
 * - Supabase database is empty or you want to merge data
 * - You have backups of both databases
 * - You've tested the connection first
 */

require('dotenv').config();
const path = require('path');
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// SQLite connection (source)
const sqlitePath = path.join(__dirname, '../database.sqlite');
const sqliteSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: sqlitePath,
  logging: false
});

// PostgreSQL connection (destination - Supabase)
let postgresSequelize;
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL not found in .env file. Please set it to your Supabase connection string.');
  process.exit(1);
}

postgresSequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

/**
 * Migrate data from one table to another
 * @param {string} tableName - Name of the table to migrate
 * @param {Array} excludeColumns - Columns to exclude (e.g., ['id'] to let PostgreSQL generate new IDs)
 */
async function migrateTable(tableName, excludeColumns = []) {
  try {
    logger.info(`Starting migration for table: ${tableName}`);
    
    // Fetch all data from SQLite
    const [sqliteData] = await sqliteSequelize.query(
      `SELECT * FROM ${tableName}`,
      { type: sqliteSequelize.QueryTypes.SELECT }
    );
    
    if (!sqliteData || sqliteData.length === 0) {
      logger.info(`No data found in ${tableName}, skipping...`);
      return { migrated: 0, skipped: 0 };
    }
    
    const dataArray = Array.isArray(sqliteData) ? sqliteData : [sqliteData];
    logger.info(`Found ${dataArray.length} records in ${tableName}`);
    
    // Prepare data for insertion (exclude specified columns)
    const records = dataArray.map(record => {
      const newRecord = { ...record };
      excludeColumns.forEach(col => delete newRecord[col]);
      return newRecord;
    });
    
    if (records.length === 0) {
      logger.warn(`No records to migrate after filtering columns`);
      return { migrated: 0, skipped: 0 };
    }
    
    // Get column names (excluding specified columns)
    const columns = Object.keys(records[0]);
    const columnNames = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    // Insert data into PostgreSQL
    let migrated = 0;
    let skipped = 0;
    
    for (const record of records) {
      try {
        const values = columns.map(col => record[col]);
        await postgresSequelize.query(
          `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          {
            bind: values,
            type: postgresSequelize.QueryTypes.INSERT
          }
        );
        migrated++;
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          logger.warn(`Skipping duplicate record in ${tableName}: ${error.message}`);
          skipped++;
        } else {
          logger.error(`Error inserting record into ${tableName}:`, error.message);
          throw error;
        }
      }
    }
    
    logger.info(`✅ Migrated ${migrated} records, skipped ${skipped} duplicates from ${tableName}`);
    return { migrated, skipped };
    
  } catch (error) {
    logger.error(`❌ Error migrating table ${tableName}:`, error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateData() {
  const transaction = await postgresSequelize.transaction();
  
  try {
    logger.info('🚀 Starting data migration from SQLite to Supabase...');
    logger.info('⚠️  Make sure all tables are created in Supabase first (run migrations)');
    
    // Test connections
    logger.info('Testing SQLite connection...');
    await sqliteSequelize.authenticate();
    logger.info('✅ SQLite connection successful');
    
    logger.info('Testing Supabase connection...');
    await postgresSequelize.authenticate();
    logger.info('✅ Supabase connection successful');
    
    // Migration order matters due to foreign key constraints
    // 1. Users (no dependencies)
    const usersResult = await migrateTable('Users', []);
    logger.info(`Users: ${usersResult.migrated} migrated, ${usersResult.skipped} skipped`);
    
    // 2. Categories (no dependencies)
    const categoriesResult = await migrateTable('Categories', []);
    logger.info(`Categories: ${categoriesResult.migrated} migrated, ${categoriesResult.skipped} skipped`);
    
    // 3. Products (depends on Categories)
    const productsResult = await migrateTable('Products', []);
    logger.info(`Products: ${productsResult.migrated} migrated, ${productsResult.skipped} skipped`);
    
    // 4. Carts (depends on Users)
    const cartsResult = await migrateTable('Carts', []);
    logger.info(`Carts: ${cartsResult.migrated} migrated, ${cartsResult.skipped} skipped`);
    
    // 5. CartItems (depends on Carts and Products)
    const cartItemsResult = await migrateTable('CartItems', []);
    logger.info(`CartItems: ${cartItemsResult.migrated} migrated, ${cartItemsResult.skipped} skipped`);
    
    // 6. Orders (depends on Users)
    const ordersResult = await migrateTable('Orders', []);
    logger.info(`Orders: ${ordersResult.migrated} migrated, ${ordersResult.skipped} skipped`);
    
    // 7. OrderItems (depends on Orders and Products)
    const orderItemsResult = await migrateTable('OrderItems', []);
    logger.info(`OrderItems: ${orderItemsResult.migrated} migrated, ${orderItemsResult.skipped} skipped`);
    
    // 8. Reviews (depends on Users and Products)
    try {
      const reviewsResult = await migrateTable('Reviews', []);
      logger.info(`Reviews: ${reviewsResult.migrated} migrated, ${reviewsResult.skipped} skipped`);
    } catch (error) {
      logger.warn(`Reviews table migration failed (may not exist): ${error.message}`);
    }
    
    // 9. Wishlists (depends on Users and Products)
    try {
      const wishlistsResult = await migrateTable('Wishlists', []);
      logger.info(`Wishlists: ${wishlistsResult.migrated} migrated, ${wishlistsResult.skipped} skipped`);
    } catch (error) {
      logger.warn(`Wishlists table migration failed (may not exist): ${error.message}`);
    }
    
    // 10. RefreshTokens (depends on Users)
    try {
      const refreshTokensResult = await migrateTable('RefreshTokens', []);
      logger.info(`RefreshTokens: ${refreshTokensResult.migrated} migrated, ${refreshTokensResult.skipped} skipped`);
    } catch (error) {
      logger.warn(`RefreshTokens table migration failed (may not exist): ${error.message}`);
    }
    
    await transaction.commit();
    logger.info('✅ Data migration completed successfully!');
    
  } catch (error) {
    await transaction.rollback();
    logger.error('❌ Data migration failed:', error);
    throw error;
  } finally {
    await sqliteSequelize.close();
    await postgresSequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateData()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateData;

