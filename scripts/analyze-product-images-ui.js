/**
 * Script to analyze how many images are shown per product in the UI
 */

const sequelize = require('../config/database');
const Category = require('../models/Category');
const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');

async function analyzeProductImagesUI() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Get all categories with products
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'slug'],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });

    console.log('🖼️  IMAGES PER PRODUCT IN UI ANALYSIS:');
    console.log('='.repeat(100));
    console.log('\n');

    let totalProducts = 0;
    let productsWithSingleImage = 0;
    let productsWithMultipleImages = 0;
    let totalImagesInDB = 0;
    let totalImagesInFolders = 0;

    for (const category of categories) {
      const products = await Product.findAll({
        where: { categoryId: category.id },
        attributes: ['id', 'name', 'image_url'],
        raw: true
      });

      if (products.length === 0) continue;

      console.log(`📁 ${category.name} (${products.length} products)`);
      console.log('-'.repeat(100));

      let categorySingleImage = 0;
      let categoryMultipleImages = 0;
      let categoryImagesInDB = 0;
      let categoryImagesInFolders = 0;

      for (const product of products) {
        totalProducts++;
        
        // Check database: Only 1 image_url per product
        const hasImage = product.image_url && product.image_url !== 'no-image.jpg';
        if (hasImage) {
          categoryImagesInDB++;
          totalImagesInDB++;
          productsWithSingleImage++;
          categorySingleImage++;
        }

        // Check if folder exists and count images in folder
        // Extract folder name from image_url (e.g., "products/BAMBOO DISH SCRUB/..." -> "BAMBOO DISH SCRUB")
        let folderName = null;
        if (product.image_url) {
          const parts = product.image_url.split('/');
          if (parts.length >= 2 && parts[0] === 'products') {
            folderName = parts[1];
          }
        }

        // Check actual folder for multiple images
        if (folderName) {
          const ezyZipPath = path.join(__dirname, '../../ezyZip', folderName);
          const publicPath = path.join(__dirname, '../../myshopReact/my-project/public/products/ezyZip', folderName);
          
          let imageCount = 0;
          if (fs.existsSync(ezyZipPath)) {
            const files = fs.readdirSync(ezyZipPath);
            imageCount = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
          } else if (fs.existsSync(publicPath)) {
            const files = fs.readdirSync(publicPath);
            imageCount = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
          }

          if (imageCount > 1) {
            categoryImagesInFolders += imageCount;
            totalImagesInFolders += imageCount;
            categoryMultipleImages++;
            productsWithMultipleImages++;
            console.log(`   ${product.name} (ID: ${product.id})`);
            console.log(`      Images in DB: 1 (${product.image_url})`);
            console.log(`      Images in folder: ${imageCount} (but only 1 shown in UI)`);
          } else {
            categoryImagesInFolders += imageCount || 1;
            totalImagesInFolders += imageCount || 1;
          }
        }
      }

      console.log(`   Summary: ${categorySingleImage} products with images`);
      console.log(`   Images stored in DB: ${categoryImagesInDB} (1 per product)`);
      console.log(`   Images available in folders: ${categoryImagesInFolders} (multiple per product, but not used)`);
      console.log(`   Images shown in UI: ${categoryImagesInDB} (only 1 per product)`);
      console.log();
    }

    console.log('\n📊 OVERALL SUMMARY:');
    console.log('='.repeat(100));
    console.log(`Total Products: ${totalProducts}`);
    console.log(`Products with Images in DB: ${productsWithSingleImage} (100%)`);
    console.log(`Products with Multiple Images Available: ${productsWithMultipleImages}`);
    console.log(`\nImages in Database: ${totalImagesInDB} (1 per product)`);
    console.log(`Images Available in Folders: ${totalImagesInFolders} (multiple per product)`);
    console.log(`Images Shown in UI: ${totalImagesInDB} (only 1 per product)`);
    console.log(`\n⚠️  ISSUE: Backend stores only 1 image per product, but folders contain multiple images.`);
    console.log(`   The UI ProductCard component supports image galleries, but only 1 image is shown`);
    console.log(`   because the backend only provides 1 image_url per product.`);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeProductImagesUI();

