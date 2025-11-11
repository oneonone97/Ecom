const Product = require('../models/Product');
const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');

async function fixImagePaths() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Get all products
    const products = await Product.findAll({
      attributes: ['id', 'name', 'image_url']
    });

    console.log(`📦 Found ${products.length} products to check\n`);

    const publicProductsPath = path.join(__dirname, '../../myshopReact/my-project/public/products');
    
    let fixedCount = 0;
    let missingCount = 0;

    for (const product of products) {
      if (!product.image_url) {
        console.log(`⚠️  Product "${product.name}" has no image_url`);
        missingCount++;
        continue;
      }

      // Extract folder and filename from current image_url
      const imagePath = product.image_url;
      const pathParts = imagePath.split('/');
      const folderName = pathParts[1];
      const currentFileName = pathParts[2];

      console.log(`\n🔍 Checking: ${product.name}`);
      console.log(`   Current path: ${imagePath}`);
      console.log(`   Folder: ${folderName}`);
      console.log(`   Current filename: ${currentFileName}`);

      // Check if the current image file exists
      const fullImagePath = path.join(publicProductsPath, folderName, currentFileName);
      
      if (fs.existsSync(fullImagePath)) {
        console.log(`   ✅ Image file exists`);
        continue;
      }

      console.log(`   ❌ Image file NOT found: ${fullImagePath}`);

      // Try to find the correct image file in the folder
      const folderPath = path.join(publicProductsPath, folderName);
      
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        const imageFiles = files.filter(file => 
          /\.(jpg|jpeg|png|webp)$/i.test(file)
        );

        if (imageFiles.length > 0) {
          // Find the best matching image
          let bestMatch = imageFiles[0]; // Default to first image
          
          // Try to find a "banner" or "main" image first
          const bannerImage = imageFiles.find(file => 
            file.toLowerCase().includes('banner') || 
            file.toLowerCase().includes('main') ||
            file.toLowerCase().includes('front')
          );
          
          if (bannerImage) {
            bestMatch = bannerImage;
          }

          const newImagePath = `products/${folderName}/${bestMatch}`;
          
          console.log(`   🔄 Updating to: ${newImagePath}`);
          
          // Update the product in database
          await Product.update(
            { image_url: newImagePath },
            { where: { id: product.id } }
          );
          
          fixedCount++;
          console.log(`   ✅ Fixed!`);
        } else {
          console.log(`   ⚠️  No image files found in folder`);
          missingCount++;
        }
      } else {
        console.log(`   ❌ Folder not found: ${folderPath}`);
        missingCount++;
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Fixed: ${fixedCount} products`);
    console.log(`   ⚠️  Missing: ${missingCount} products`);
    console.log(`   📦 Total checked: ${products.length} products`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

fixImagePaths();
