/**
 * Script to check current product categories
 * Usage: node scripts/check-product-categories.js
 */

const sequelize = require('../config/database');
const Product = require('../models/Product');

async function checkProductCategories() {
  try {
    console.log('\n🔍 CHECKING PRODUCT CATEGORIES');
    console.log('================================');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Check the specific products
    const products = ['GAMING KEYBOARD & MOUSE', 'GAMING MOUSE', 'KEYBOARD & MOUSE', 'LAPTOP BAG'];
    
    console.log('\n📋 Current product categories:');
    
    for (const name of products) {
      const product = await Product.findOne({ 
        where: { name: name },
        attributes: ['id', 'name', 'categoryId']
      });
      
      if (product) {
        console.log(`   ${name}: Category ID ${product.categoryId}`);
      } else {
        console.log(`   ${name}: Not found`);
      }
    }

    // Also check what products are in Personal Care (category ID 2)
    console.log('\n📱 Products currently in Personal Care (ID: 2):');
    const personalCareProducts = await Product.findAll({
      where: { categoryId: 2 },
      attributes: ['id', 'name', 'categoryId'],
      limit: 10
    });
    
    personalCareProducts.forEach(product => {
      console.log(`   ${product.name}: Category ID ${product.categoryId}`);
    });

  } catch (error) {
    console.error('\n❌ Error checking product categories:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  checkProductCategories();
}

module.exports = { checkProductCategories };
