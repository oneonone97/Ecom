/**
 * Product Images Migration Script: Local to Supabase Storage
 *
 * This script migrates existing product images from local storage to Supabase Storage.
 * It reads images from the local uploads directory, uploads them to Supabase,
 * and updates the database with the new Supabase URLs.
 *
 * Usage:
 * node scripts/migrate-product-images-to-supabase.js
 *
 * Prerequisites:
 * - Supabase Storage bucket must exist and be public
 * - SUPABASE_SERVICE_ROLE_KEY must be configured
 * - Local image files must exist in uploads/products/ directory
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../utils/database');
const { uploadImage, isConfigured } = require('../utils/supabaseStorage');
const logger = require('../utils/logger');

async function migrateProductImages() {
  try {
    console.log('\n🖼️  Product Images Migration: Local → Supabase Storage');
    console.log('======================================================\n');

    if (!isConfigured()) {
      console.error('❌ Supabase Storage is not configured!');
      console.error('   Please set SUPABASE_SERVICE_ROLE_KEY in .env file\n');
      return false;
    }

    console.log('✅ Supabase Storage client initialized\n');

    // Get all products with image URLs
    console.log('1. Finding products with images...');
    const products = await db.products.findAll();

    if (products.length === 0) {
      console.log('   ⚠️  No products with images found\n');
      return true;
    }

    console.log(`   ✅ Found ${products.length} products with images\n`);

    // Local uploads directory
    const uploadsDir = path.join(__dirname, '../uploads/products');
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'products';

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('2. Starting migration...\n');

    // Filter products that have images
    const productsWithImages = products.filter(p => p.image_url && p.image_url.trim() !== '');

    if (productsWithImages.length === 0) {
      console.log('   ⚠️  No products with images found after filtering\n');
      return true;
    }

    console.log(`   Found ${productsWithImages.length} products with images to migrate\n`);

    for (const product of productsWithImages) {
      try {
        console.log(`   Processing: ${product.name} (ID: ${product.id})`);

        // Check if already a Supabase URL
        if (product.image_url && product.image_url.includes('supabase.co')) {
          console.log(`     ⏭️  Already migrated: ${product.image_url.substring(0, 50)}...`);
          skipped++;
          continue;
        }

        // Extract local file path
        let localFilePath = null;

        // Handle different image URL formats
        if (product.image_url.startsWith('http')) {
          // Already a remote URL (like placeholder), skip migration
          console.log(`     ⏭️  Remote URL detected, skipping: ${product.image_url.substring(0, 50)}...`);
          skipped++;
          continue;
        } else if (product.image_url.startsWith('/products/')) {
          // Frontend public path: /products/folder/filename.jpg
          // Try multiple possible locations
          const possiblePaths = [
            path.join(__dirname, '../../myshopReact/my-project/public', product.image_url),
            path.join(__dirname, '../uploads/products', product.image_url.replace('/products/', '')),
            path.join(__dirname, '../uploads/products', product.image_url)
          ];

          for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
              localFilePath = testPath;
              break;
            }
          }
        } else if (product.image_url.startsWith('products/')) {
          // Products folder path: products/folder/filename.jpg
          const possiblePaths = [
            path.join(__dirname, '../../myshopReact/my-project/public', product.image_url),
            path.join(__dirname, '../uploads/products', product.image_url.replace('products/', ''))
          ];

          for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
              localFilePath = testPath;
              break;
            }
          }
        } else if (product.image_url.startsWith('/uploads/')) {
          // Local upload path: /uploads/products/filename.jpg
          localFilePath = path.join(__dirname, '..', product.image_url);
        } else {
          // Try local uploads directory
          localFilePath = path.join(uploadsDir, product.image_url);
        }

        if (!localFilePath || !fs.existsSync(localFilePath)) {
          console.log(`     ❌ Local file not found: ${localFilePath || product.image_url}`);
          errors++;
          continue;
        }

        // Read the image file
        console.log(`     📁 Reading file: ${path.basename(localFilePath)}`);
        const fileBuffer = fs.readFileSync(localFilePath);
        const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);

        // Determine MIME type from file extension
        const fileExtension = path.extname(localFilePath).toLowerCase();
        const mimeType = fileExtension === '.png' ? 'image/png' :
                        fileExtension === '.gif' ? 'image/gif' :
                        fileExtension === '.webp' ? 'image/webp' : 'image/jpeg';

        // Generate Supabase file path
        const filePath = `products/${product.id}/main${fileExtension}`;

        // Upload to Supabase
        console.log(`     ☁️  Uploading to Supabase (${fileSizeKB} KB)...`);
        const publicUrl = await uploadImage(fileBuffer, bucketName, filePath, mimeType);

        // Update database with new URL
        await db.products.update(product.id, { image_url: publicUrl });

        console.log(`     ✅ Migrated: ${publicUrl.substring(0, 60)}...`);
        migrated++;

      } catch (error) {
        console.log(`     ❌ Error migrating ${product.name}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n========== MIGRATION SUMMARY ==========');
    console.log(`Total products: ${products.length}`);
    console.log(`Successfully migrated: ${migrated}`);
    console.log(`Already migrated: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('=======================================\n');

    if (errors > 0) {
      console.log('⚠️  Some images failed to migrate. Check the errors above.');
      console.log('   You may need to manually upload those images or fix the file paths.\n');
    }

    if (migrated > 0) {
      console.log('✅ Migration completed successfully!');
      console.log('   All product images are now stored in Supabase Storage.\n');
    }

    return true;

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check SUPABASE_SERVICE_ROLE_KEY in .env');
    console.error('   2. Verify Supabase Storage bucket exists and is public');
    console.error('   3. Ensure local image files exist in uploads/products/');
    console.error('   4. Check file permissions\n');
    return false;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateProductImages()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateProductImages;
