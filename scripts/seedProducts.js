const sequelize = require('../config/database');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { Cart, CartItem } = require('../models/Cart'); // Corrected import for Cart and CartItem models
const { ezyZipProducts, categories } = require('../seeds/ezyZipProducts');

async function seedProducts() {
  try {
    console.log('Starting database seed...');

    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync models (ensure tables exist)
    await sequelize.sync();
    console.log('Database models synchronized.');

    // Clear existing data
    console.log('\nClearing existing data from dependent tables...');
    await sequelize.sync({ force: true });
    console.log('Existing products and categories cleared.');

    // Create categories
    console.log('\nCreating categories...');
    const createdCategories = {};
    for (const category of categories) {
      const newCategory = await Category.create(category);
      createdCategories[newCategory.name] = newCategory;
      console.log(`  ✓ Created category: ${newCategory.name}`);
    }
    console.log(`\nTotal categories created: ${Object.keys(createdCategories).length}`);

    // Note: The Product model needs to be updated to support the new fields
    // For now, we'll insert what we can based on the current model structure
    console.log('\nCreating products...');
    let createdCount = 0;
    let errorCount = 0;

    for (const productData of ezyZipProducts) {
      try {
        const category = createdCategories[productData.category];
        if (!category) {
          throw new Error(`Category not found for product: ${productData.name}`);
        }

        const priceRupees = Number(productData.price) || 0;
        const productToCreate = {
          name: productData.name,
          description: productData.description || productData.shortDescription || productData.name,
          price_paise: Math.round(priceRupees * 100),
          sale_price_paise: null,
          categoryId: category.id, // Use the category ID
          image_url: productData.image || (productData.images && productData.images.main) || 'no-image.jpg',
          stock: Number.isFinite(productData.stock) ? productData.stock : 10,
          featured: !!productData.featured,
          is_new: !!productData.isNew,
          is_sale: !!productData.isSale
        };

        await Product.create(productToCreate);
        createdCount++;
        console.log(`  ✓ Created product: ${productData.name}`);
      } catch (error) {
        errorCount++;
        console.error(`  ✗ Error creating product ${productData.name}:`, error.message);
      }
    }

    console.log(`\n========== SEED SUMMARY ==========`);
    console.log(`Total products in seed file: ${ezyZipProducts.length}`);
    console.log(`Successfully created: ${createdCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Categories created: ${Object.keys(createdCategories).length}`);
    console.log(`==================================\n`);

    if (errorCount > 0) {
      console.log('NOTE: Some products failed to create due to model constraints.');
      console.log('You may need to update the Product model to support additional fields:');
      console.log('  - originalPrice, rating, reviews, inStock, isNew, isSale, discount');
      console.log('  - images (JSON array), colors (JSON array), sizes (JSON array)');
      console.log('\nUpdate MyShop-backend/models/Product.js to include these fields.');
    }

    console.log('Database seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedProducts();
