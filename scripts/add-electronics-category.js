/**
 * Script to add Electronics category and update product mappings
 * Moves gaming/tech products from Personal Care to Electronics
 * Usage: node scripts/add-electronics-category.js
 */

const sequelize = require('../config/database');
const Category = require('../models/Category');
const Product = require('../models/Product');
const logger = require('../utils/logger');

// Products to move from Personal Care to Electronics (exact names from database)
const ELECTRONICS_PRODUCTS = [
  'Gaming Keyboard & Mouse',
  'Gaming Mouse', 
  'Keyboard & Mouse',
  'Laptop Bag'
];

async function addElectronicsCategory() {
  try {
    console.log('\n🔌 ADDING ELECTRONICS CATEGORY AND UPDATING MAPPINGS');
    console.log('=====================================================');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Create Electronics category
    console.log('\n📱 Creating Electronics Category...');
    
    const [electronicsCategory, created] = await Category.findOrCreate({
      where: { slug: 'electronics' },
      defaults: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Cutting-edge electronics and gaming accessories for tech enthusiasts',
        image: 'electronics-category.jpg',
        isActive: true,
        sortOrder: 7 // After the existing 6 categories
      }
    });

    if (created) {
      console.log('   ✅ Electronics category created successfully');
    } else {
      console.log('   ℹ️  Electronics category already exists');
    }

    // Update product mappings
    console.log('\n🎮 Moving tech products to Electronics category...');
    
    let movedCount = 0;
    
    for (const productName of ELECTRONICS_PRODUCTS) {
      const [updatedRows] = await Product.update(
        { categoryId: electronicsCategory.id },
        { 
          where: { 
            name: productName,
            categoryId: 2 // Personal Care category ID
          }
        }
      );
      
      if (updatedRows > 0) {
        movedCount += updatedRows;
        console.log(`   ✅ Moved: ${productName}`);
      } else {
        console.log(`   ⚠️  Not found or already in correct category: ${productName}`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Electronics category: ${electronicsCategory.name} (ID: ${electronicsCategory.id})`);
    console.log(`   ✅ Products moved: ${movedCount}`);
    console.log(`\n🎉 Electronics category and mappings updated successfully!`);

  } catch (error) {
    console.error('\n❌ Error adding Electronics category:', error.message);
    logger.error('Error in add-electronics-category:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  addElectronicsCategory();
}

module.exports = { addElectronicsCategory, ELECTRONICS_PRODUCTS };
