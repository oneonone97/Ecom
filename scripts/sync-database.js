/**
 * Script to sync database models and create missing tables
 * Usage: node scripts/sync-database.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = require('../config/database');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');

async function syncDatabase() {
  try {
    console.log('\n🔄 DATABASE SYNC');
    console.log('=================');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync all models
    console.log('\n📊 Syncing database models...');
    
    // Sync User model first (RefreshToken depends on it)
    await User.sync();
    console.log('✅ Users table synced');
    
    // Sync RefreshToken model
    await RefreshToken.sync();
    console.log('✅ RefreshTokens table synced');
    
    // Sync any other models that might exist
    await sequelize.sync();
    console.log('✅ All models synced successfully');

    console.log('\n✅ Database sync completed!');
    console.log('📝 All tables should now be available.');
    
  } catch (error) {
    console.error('\n❌ Database sync failed:', error.message);
    logger.error('Database sync error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the sync
syncDatabase();
