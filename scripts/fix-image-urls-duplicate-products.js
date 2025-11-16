/**
 * Fix duplicate "products" in image URLs
 * The migration script created paths like "products/45/main.jpg" 
 * but the bucket is already "products", causing URLs like:
 * /products/products/45/main.jpg
 * 
 * This script fixes the database URLs to remove the duplicate.
 */

require('dotenv').config();
const db = require('../utils/database');
const logger = require('../utils/logger');

async function fixImageUrls() {
  try {
    console.log('\n🔧 Fixing Duplicate "products" in Image URLs');
    console.log('==============================================\n');

    // Get all products with Supabase URLs
    const products = await db.products.findAll();

    if (products.length === 0) {
      console.log('⚠️  No products found');
      return;
    }

    console.log(`✅ Found ${products.length} products\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of products) {
      try {
        if (!product.image_url || typeof product.image_url !== 'string') {
          skipped++;
          continue;
        }

        // Check if URL has duplicate "products"
        // Pattern: .../products/products/...
        if (product.image_url.includes('/products/products/')) {
          // Fix the URL by removing one "products"
          const fixedUrl = product.image_url.replace('/products/products/', '/products/');
          
          console.log(`   Fixing product ${product.id} (${product.name}):`);
          console.log(`   Old: ${product.image_url.substring(0, 80)}...`);
          console.log(`   New: ${fixedUrl.substring(0, 80)}...`);
          
          // Update database
          await db.products.update(product.id, { image_url: fixedUrl });
          
          fixed++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.log(`   ❌ Error fixing product ${product.id}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n========== SUMMARY ==========');
    console.log(`Total products: ${products.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('=============================\n');

    if (fixed > 0) {
      console.log('✅ Image URLs fixed successfully!\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run fix
fixImageUrls();

