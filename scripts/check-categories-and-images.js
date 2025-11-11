const Category = require('../models/Category');
const Product = require('../models/Product');
const sequelize = require('../config/database');

async function checkCategoriesAndImages() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Check all categories
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'slug', 'image', 'isActive']
    });
    
    console.log('📁 Current Categories:');
    categories.forEach(cat => {
      console.log(`   ID: ${cat.id} | ${cat.name} | slug: ${cat.slug} | image: ${cat.image} | active: ${cat.isActive}`);
    });

    // Check Kitchen category specifically
    const kitchenCategory = categories.find(c => c.name === 'Kitchen');
    if (kitchenCategory) {
      console.log(`\n🍽️  Kitchen Category Details:`);
      console.log(`   ID: ${kitchenCategory.id}`);
      console.log(`   Name: ${kitchenCategory.name}`);
      console.log(`   Image: ${kitchenCategory.image}`);
      console.log(`   Active: ${kitchenCategory.isActive}`);

      const kitchenProducts = await Product.findAll({
        where: { categoryId: kitchenCategory.id },
        attributes: ['id', 'name', 'image_url', 'categoryId']
      });
      
      console.log(`\n🍽️  Kitchen Products (${kitchenProducts.length} total):`);
      kitchenProducts.forEach(prod => {
        console.log(`   ${prod.name} | image: ${prod.image_url || 'NO IMAGE'}`);
      });
    } else {
      console.log('\n❌ Kitchen category not found!');
    }

    // Check if images exist in filesystem
    console.log('\n📸 Checking Image Files:');
    const fs = require('fs');
    const path = require('path');
    
    // Check ezyZip folder structure
    const ezyZipPath = path.join(__dirname, '../../ezyZip');
    if (fs.existsSync(ezyZipPath)) {
      const folders = fs.readdirSync(ezyZipPath).filter(item => 
        fs.statSync(path.join(ezyZipPath, item)).isDirectory()
      );
      
      console.log(`   Found ${folders.length} folders in ezyZip:`);
      folders.forEach(folder => {
        const folderPath = path.join(ezyZipPath, folder);
        const images = fs.readdirSync(folderPath).filter(file => 
          /\.(jpg|jpeg|png|webp)$/i.test(file)
        );
        console.log(`   📁 ${folder}: ${images.length} images`);
      });
    } else {
      console.log('   ❌ ezyZip folder not found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkCategoriesAndImages();
