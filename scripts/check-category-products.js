/**
 * Script to check products per category and their images
 */

const sequelize = require('../config/database');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { Op } = require('sequelize');

async function checkCategoryProducts() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Get all categories
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'slug'],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });

    console.log('📊 PRODUCTS PER CATEGORY:');
    console.log('='.repeat(100));
    console.log('\n');

    let totalProducts = 0;
    let totalWithImages = 0;
    let totalWithoutImages = 0;

    for (const category of categories) {
      // Count products in this category
      const productCount = await Product.count({
        where: { categoryId: category.id }
      });

      // Get products with image details
      const products = await Product.findAll({
        where: { categoryId: category.id },
        attributes: ['id', 'name', 'image_url'],
        raw: true
      });

      const withImages = products.filter(p => p.image_url && p.image_url !== 'no-image.jpg' && p.image_url.trim() !== '').length;
      const withoutImages = products.length - withImages;

      totalProducts += productCount;
      totalWithImages += withImages;
      totalWithoutImages += withoutImages;

      console.log(`📁 ${category.name} (ID: ${category.id}, Slug: ${category.slug})`);
      console.log(`   Total Products: ${productCount}`);
      console.log(`   Products with Images: ${withImages}`);
      console.log(`   Products without Images: ${withoutImages}`);
      
      if (productCount > 0 && productCount <= 5) {
        console.log(`   Product Details:`);
        products.forEach((p, idx) => {
          const hasImage = p.image_url && p.image_url !== 'no-image.jpg' && p.image_url.trim() !== '';
          console.log(`      ${idx + 1}. ${p.name} (ID: ${p.id}) - Image: ${hasImage ? '✅ ' + p.image_url : '❌ None'}`);
        });
      } else if (productCount > 5) {
        console.log(`   Sample Products (first 5):`);
        products.slice(0, 5).forEach((p, idx) => {
          const hasImage = p.image_url && p.image_url !== 'no-image.jpg' && p.image_url.trim() !== '';
          console.log(`      ${idx + 1}. ${p.name} (ID: ${p.id}) - Image: ${hasImage ? '✅ ' + p.image_url : '❌ None'}`);
        });
        console.log(`      ... and ${productCount - 5} more products`);
      }
      
      console.log('-'.repeat(100));
      console.log();
    }

    console.log('\n📈 SUMMARY:');
    console.log('='.repeat(100));
    console.log(`Total Categories: ${categories.length}`);
    console.log(`Total Products: ${totalProducts}`);
    console.log(`Products with Images: ${totalWithImages} (${totalProducts > 0 ? ((totalWithImages / totalProducts) * 100).toFixed(1) : 0}%)`);
    console.log(`Products without Images: ${totalWithoutImages} (${totalProducts > 0 ? ((totalWithoutImages / totalProducts) * 100).toFixed(1) : 0}%)`);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkCategoryProducts();

