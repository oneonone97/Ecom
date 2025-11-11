/**
 * Script to sync ALL database models and create missing tables
 * Usage: node scripts/sync-all-tables.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = require('../config/database');

// Import all available models
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { Cart, CartItem } = require('../models/Cart');
const { Order, OrderItem } = require('../models/Order');
const Review = require('../models/Review');
const { Wishlist, WishlistItem } = require('../models/Wishlist');

const logger = require('../utils/logger');

async function syncAllTables() {
  try {
    console.log('\n🔄 COMPREHENSIVE DATABASE SYNC');
    console.log('=====================================');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync all models in correct order (respect foreign key dependencies)
    console.log('\n📊 Syncing all database models...');
    
    // Models without dependencies first
    console.log('1. Syncing User model...');
    await User.sync();
    console.log('   ✅ Users table synced');
    
    console.log('2. Syncing Category model...');
    await Category.sync();
    console.log('   ✅ Categories table synced');
    
    console.log('3. Syncing Product model...');
    await Product.sync();
    console.log('   ✅ Products table synced');
    
    console.log('4. Syncing RefreshToken model...');
    await RefreshToken.sync();
    console.log('   ✅ RefreshTokens table synced');
    
    console.log('5. Syncing Cart model...');
    await Cart.sync();
    console.log('   ✅ Carts table synced');
    
    console.log('6. Syncing Order model...');
    await Order.sync();
    console.log('   ✅ Orders table synced');
    
    console.log('7. Syncing Review model...');
    await Review.sync();
    console.log('   ✅ Reviews table synced');
    
    console.log('8. Syncing Wishlist model...');
    await Wishlist.sync();
    console.log('   ✅ Wishlists table synced');

    // Final sync to ensure all relationships are properly established
    console.log('\n12. Final comprehensive sync...');
    await sequelize.sync();
    console.log('   ✅ All models and relationships synced');

    console.log('\n✅ COMPREHENSIVE DATABASE SYNC COMPLETED!');
    console.log('📝 All tables are now available for full application functionality.');
    
    // Show summary of created tables
    console.log('\n📋 Created Tables Summary:');
    const tables = [
      'Users', 'Categories', 'Products', 'RefreshTokens', 'Carts', 
      'Orders', 'Reviews', 'Wishlists'
    ];
    tables.forEach(table => console.log(`   ✅ ${table}`));
    
  } catch (error) {
    console.error('\n❌ Database sync failed:', error.message);
    logger.error('Comprehensive database sync error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the comprehensive sync
syncAllTables();
