/**
 * Fix image URLs to match actual storage paths
 * 
 * Issue: Database has URLs like /products/46/main.jpg (path: 46/main.jpg)
 * But files are actually at: products/46/main.jpg (path includes "products" folder)
 * 
 * This script updates database URLs to include "products/" prefix in the path
 */

require('dotenv').config();
const db = require('../utils/database');
const logger = require('../utils/logger');

async function fixImageUrls() {
  try {
    console.log('\n🔧 Fixing Image URLs to Match Storage Paths');
    console.log('============================================\n');

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

        // Check if it's a Supabase URL
        if (!product.image_url.includes('supabase.co/storage/v1/object/public/products/')) {
          skipped++;
          continue;
        }

        // Extract the path from URL
        // Current format: https://...supabase.co/storage/v1/object/public/products/46/main.jpg
        // This means path in bucket is: 46/main.jpg
        // But actual path is: products/46/main.jpg
        
        // Check if URL already has "products/" in the path part
        const urlMatch = product.image_url.match(/\/products\/(.+)$/);
        if (!urlMatch) {
          skipped++;
          continue;
        }

        const currentPath = urlMatch[1]; // e.g., "46/main.jpg"
        
        // If path doesn't start with "products/", add it
        if (!currentPath.startsWith('products/')) {
          const newPath = `products/${currentPath}`;
          const newUrl = product.image_url.replace(`/products/${currentPath}`, `/products/${newPath}`);
          
          console.log(`   Fixing product ${product.id} (${product.name}):`);
          console.log(`   Old path: ${currentPath}`);
          console.log(`   New path: ${newPath}`);
          console.log(`   New URL: ${newUrl.substring(0, 80)}...`);
          
          // Update database
          await db.products.update(product.id, { image_url: newUrl });
          
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
      console.log('✅ Image URLs fixed successfully!');
      console.log('   URLs now match the actual storage paths.\n');
    } else {
      console.log('ℹ️  No URLs needed fixing (all are correct).\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run fix
fixImageUrls();

