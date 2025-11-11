/**
 * Debug script for Kitchen and Personal Care image rendering issues
 */

const sequelize = require('../config/database');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { getImageGallery } = require('../utils/imageUtils');
const fs = require('fs');
const path = require('path');

async function debugKitchenPersonalCare() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const kitchen = await Category.findOne({ where: { name: 'Kitchen' } });
    const personalCare = await Category.findOne({ where: { name: 'Personal Care' } });

    console.log('🔍 DEBUGGING KITCHEN & PERSONAL CARE IMAGES\n');
    console.log('='.repeat(100));

    // Test Kitchen products
    console.log('\n📁 KITCHEN PRODUCTS:\n');
    const kitchenProducts = await Product.findAll({
      where: { categoryId: kitchen.id },
      attributes: ['id', 'name', 'image_url'],
      limit: 3
    });

    for (const product of kitchenProducts) {
      console.log(`\n${product.name} (ID: ${product.id})`);
      console.log(`  Database image_url: ${product.image_url}`);
      
      // Test image gallery
      const gallery = getImageGallery(product.image_url);
      console.log(`  Gallery found: ${gallery.gallery.length} images`);
      
      // Check if first image exists
      const firstImage = gallery.gallery[0];
      const possiblePaths = [
        path.join(__dirname, '../../myshopReact/my-project/public', firstImage),
        path.join(__dirname, '../../myshopReact/my-project/public/products', firstImage.split('/').slice(1).join('/'))
      ];
      
      let found = false;
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          console.log(`  ✅ Image exists at: ${testPath}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`  ❌ Image NOT found at any path!`);
        console.log(`  Tried paths:`);
        possiblePaths.forEach(p => console.log(`    - ${p}`));
      }
      
      // Check folder structure
      const folderName = product.image_url.split('/')[1];
      const folderPaths = [
        path.join(__dirname, '../../myshopReact/my-project/public/products', folderName),
        path.join(__dirname, '../../ezyZip', folderName)
      ];
      
      console.log(`  Folder check:`);
      folderPaths.forEach(folderPath => {
        if (fs.existsSync(folderPath)) {
          const files = fs.readdirSync(folderPath);
          const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
          console.log(`    ✅ ${folderPath} - ${images.length} images`);
        } else {
          console.log(`    ❌ ${folderPath} - NOT FOUND`);
        }
      });
      
      console.log(`  Gallery URLs (first 3):`);
      gallery.gallery.slice(0, 3).forEach((url, i) => {
        console.log(`    ${i+1}. ${url}`);
      });
    }

    // Test Personal Care products
    console.log('\n\n📁 PERSONAL CARE PRODUCTS:\n');
    const personalCareProducts = await Product.findAll({
      where: { categoryId: personalCare.id },
      attributes: ['id', 'name', 'image_url'],
      limit: 3
    });

    for (const product of personalCareProducts) {
      console.log(`\n${product.name} (ID: ${product.id})`);
      console.log(`  Database image_url: ${product.image_url}`);
      
      // Test image gallery
      const gallery = getImageGallery(product.image_url);
      console.log(`  Gallery found: ${gallery.gallery.length} images`);
      
      // Check if first image exists
      const firstImage = gallery.gallery[0];
      const possiblePaths = [
        path.join(__dirname, '../../myshopReact/my-project/public', firstImage),
        path.join(__dirname, '../../myshopReact/my-project/public/products', firstImage.split('/').slice(1).join('/'))
      ];
      
      let found = false;
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          console.log(`  ✅ Image exists at: ${testPath}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`  ❌ Image NOT found at any path!`);
        console.log(`  Tried paths:`);
        possiblePaths.forEach(p => console.log(`    - ${p}`));
      }
      
      // Check folder structure
      const folderName = product.image_url.split('/')[1];
      const folderPaths = [
        path.join(__dirname, '../../myshopReact/my-project/public/products', folderName),
        path.join(__dirname, '../../ezyZip', folderName)
      ];
      
      console.log(`  Folder check:`);
      folderPaths.forEach(folderPath => {
        if (fs.existsSync(folderPath)) {
          const files = fs.readdirSync(folderPath);
          const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
          console.log(`    ✅ ${folderPath} - ${images.length} images`);
        } else {
          console.log(`    ❌ ${folderPath} - NOT FOUND`);
        }
      });
      
      console.log(`  Gallery URLs (first 3):`);
      gallery.gallery.slice(0, 3).forEach((url, i) => {
        console.log(`    ${i+1}. ${url}`);
      });
    }

    // Test API response format
    console.log('\n\n🌐 TESTING API RESPONSE FORMAT:\n');
    const testProduct = kitchenProducts[0];
    const ProductRepository = require('../repositories/ProductRepository');
    const productRepo = new ProductRepository();
    const enriched = productRepo.enrichWithImageGallery(testProduct);
    
    console.log('Enriched product structure:');
    console.log(`  image_url: ${enriched.image_url}`);
    console.log(`  image_gallery: ${enriched.image_gallery ? enriched.image_gallery.length + ' images' : 'null'}`);
    console.log(`  images.main: ${enriched.images?.main || 'null'}`);
    console.log(`  images.gallery: ${enriched.images?.gallery ? enriched.images.gallery.length + ' images' : 'null'}`);
    
    if (enriched.image_gallery && enriched.image_gallery.length > 0) {
      console.log('\n  First 3 gallery URLs:');
      enriched.image_gallery.slice(0, 3).forEach((url, i) => {
        console.log(`    ${i+1}. ${url}`);
      });
    }

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugKitchenPersonalCare();

