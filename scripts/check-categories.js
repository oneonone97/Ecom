/**
 * Script to check all categories in the database
 */

const sequelize = require('../config/database');
const Category = require('../models/Category');

async function checkCategories() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const categories = await Category.findAll({
      attributes: ['id', 'name', 'slug', 'description', 'image', 'isActive', 'productCount', 'parentId', 'sortOrder'],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });

    console.log('📋 CATEGORIES IN DATABASE:');
    console.log('='.repeat(80));
    console.log(`Total categories: ${categories.length}\n`);

    if (categories.length === 0) {
      console.log('⚠️  No categories found in database.');
      console.log('💡 Run: node scripts/create-categories-with-images.js');
    } else {
      categories.forEach((cat, index) => {
        console.log(`\n${index + 1}. Category Details:`);
        console.log(`   ID: ${cat.id}`);
        console.log(`   Name: ${cat.name}`);
        console.log(`   Slug: ${cat.slug}`);
        console.log(`   Description: ${cat.description || 'N/A'}`);
        console.log(`   Image: ${cat.image || 'N/A'}`);
        console.log(`   Active: ${cat.isActive}`);
        console.log(`   Product Count: ${cat.productCount}`);
        console.log(`   Sort Order: ${cat.sortOrder}`);
        console.log(`   Parent ID: ${cat.parentId || 'None (Top-level)'}`);
        console.log('-'.repeat(80));
      });
    }

    // Also check API endpoint
    console.log('\n\n🔗 API Endpoint:');
    console.log('   GET /api/products/categories');
    console.log('   Returns categories that have products');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkCategories();

