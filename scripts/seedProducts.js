const db = require('../utils/database');
const { uploadImage, isConfigured } = require('../utils/supabaseStorage');
const { ezyZipProducts, categories } = require('../seeds/ezyZipProducts');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

async function seedProducts() {
  try {
    console.log('Starting database seed with Supabase Storage...');

    // Check Supabase configuration
    if (!isConfigured()) {
      console.log('⚠️  Supabase Storage not configured. Images will be skipped.');
      console.log('   Set SUPABASE_SERVICE_ROLE_KEY in .env to enable image uploads.\n');
    } else {
      console.log('✅ Supabase Storage configured for image uploads.\n');
    }

    // Clear existing data (be careful in production!)
    console.log('Clearing existing data...');
    try {
      // Get all products and categories first for cleanup
      const existingProducts = await db.products.findAll();
      const existingCategories = await db.categories.findAll();

      // Delete products first (due to foreign key constraints)
      for (const product of existingProducts) {
        await db.products.destroy(product.id);
      }

      // Delete categories
      for (const category of existingCategories) {
        await db.categories.destroy(category.id);
      }

      console.log('✅ Existing data cleared.');
    } catch (error) {
      console.log('⚠️  Could not clear existing data, continuing with seeding...');
    }

    // Create categories
    console.log('\nCreating categories...');
    const createdCategories = {};
    for (const category of categories) {
      const categoryData = {
        name: category.name,
        slug: category.slug || category.name.toLowerCase().replace(/\s+/g, '-'),
        description: category.description || category.name,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newCategory = await db.categories.create(categoryData);
      createdCategories[newCategory.name] = newCategory;
      console.log(`  ✓ Created category: ${newCategory.name} (ID: ${newCategory.id})`);
    }
    console.log(`\nTotal categories created: ${Object.keys(createdCategories).length}`);

    // Create products
    console.log('\nCreating products...');
    let createdCount = 0;
    let errorCount = 0;
    let imageUploadCount = 0;

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
          sale_price_paise: productData.originalPrice && productData.originalPrice > priceRupees
            ? Math.round(productData.originalPrice * 100) : null,
          categoryId: category.id,
          stock: Number.isFinite(productData.stock) ? productData.stock : 10,
          isActive: true,
          is_new: !!productData.isNew,
          is_sale: !!productData.isSale,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Handle image upload to Supabase
        if (productData.image && isConfigured()) {
          try {
            let imageUploaded = false;

            // Check if it's already a remote URL (like placeholder)
            if (productData.image.startsWith('http')) {
              console.log(`    🌐 Using remote image URL: ${productData.image.substring(0, 50)}...`);
              productToCreate.imageUrl = productData.image;
              imageUploadCount++;
              imageUploaded = true;
            } else {
              // Try to find the image file locally
              let imagePath = null;

              // Check if it's a local path
              if (productData.image.startsWith('/products/') || productData.image.startsWith('products/')) {
                // Look in multiple possible locations for images
                const possiblePaths = [
                  path.join(__dirname, '../../myshopReact/my-project/public', productData.image),
                  path.join(__dirname, '../../myshopReact/my-project/public/products', productData.image.replace('/products/', '')),
                  path.join(__dirname, '../uploads/products', productData.image.replace('/products/', '')),
                  path.join(__dirname, '../uploads/products', productData.image)
                ];

                for (const testPath of possiblePaths) {
                  if (fs.existsSync(testPath)) {
                    imagePath = testPath;
                    break;
                  }
                }
              }

              if (imagePath && fs.existsSync(imagePath)) {
                console.log(`    📸 Uploading image for: ${productData.name}`);

                const fileBuffer = fs.readFileSync(imagePath);
                const fileExtension = path.extname(imagePath).toLowerCase();
                const mimeType = fileExtension === '.png' ? 'image/png' :
                                fileExtension === '.gif' ? 'image/gif' :
                                fileExtension === '.webp' ? 'image/webp' : 'image/jpeg';

                // Generate unique product ID for seeding
                const tempProductId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'products';
                const filePath = `products/${tempProductId}/main${fileExtension}`;

                const publicUrl = await uploadImage(fileBuffer, bucketName, filePath, mimeType);
                productToCreate.imageUrl = publicUrl;

                console.log(`    ✅ Image uploaded: ${publicUrl.substring(0, 50)}...`);
                imageUploadCount++;
                imageUploaded = true;
              } else {
                console.log(`    ⚠️  Image file not found: ${productData.image}`);
                // Use a placeholder image URL if local image not found
                productToCreate.imageUrl = 'https://via.placeholder.com/300x300?text=No+Image';
                console.log(`    📝 Using placeholder image`);
                imageUploaded = true;
              }
            }
          } catch (imageError) {
            console.log(`    ❌ Image upload failed for ${productData.name}: ${imageError.message}`);
            // Use placeholder on error
            productToCreate.imageUrl = 'https://via.placeholder.com/300x300?text=Upload+Failed';
            console.log(`    📝 Using error placeholder image`);
          }
        } else if (productData.image) {
          // Supabase not configured, use the original path or placeholder
          productToCreate.imageUrl = productData.image.startsWith('http')
            ? productData.image
            : 'https://via.placeholder.com/300x300?text=No+Supabase';
        }

        const createdProduct = await db.products.create(productToCreate);
        createdCount++;
        console.log(`  ✓ Created product: ${createdProduct.name} (ID: ${createdProduct.id})`);

      } catch (error) {
        errorCount++;
        console.error(`  ✗ Error creating product ${productData.name}:`, error.message);
      }
    }

    console.log(`\n========== SEED SUMMARY ==========`);
    console.log(`Total products in seed file: ${ezyZipProducts.length}`);
    console.log(`Successfully created: ${createdCount}`);
    console.log(`Images uploaded: ${imageUploadCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Categories created: ${Object.keys(createdCategories).length}`);
    console.log(`==================================\n`);

    if (errorCount > 0) {
      console.log('⚠️  Some products failed to create.');
      console.log('   Check the error messages above for details.\n');
    }

    if (imageUploadCount > 0) {
      console.log('✅ Product images successfully uploaded to Supabase Storage!');
    } else if (isConfigured()) {
      console.log('ℹ️  No images were uploaded. Check that image files exist locally.');
    }

    console.log('🎉 Database seed completed successfully!');
    console.log('   Products are now ready with Supabase-hosted images.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check database connection');
    console.error('   2. Verify Supabase Storage configuration');
    console.error('   3. Ensure image files exist locally for upload');
    console.error('   4. Check file permissions\n');
    process.exit(1);
  }
}

// Run the seed function
seedProducts();
