/**
 * Debug: Compare database image URLs vs actual Supabase Storage files
 */

require('dotenv').config();
const db = require('../utils/database');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jvtbbtymefaolozvdpet.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BUCKET_NAME = 'products';

async function debugImageMismatch() {
  try {
    console.log('\n🔍 Debugging Image URL Mismatch');
    console.log('================================\n');

    // Get products from database
    const products = await db.products.findAll({ limit: 5 });
    console.log(`✅ Found ${products.length} products in database\n`);

    for (const product of products) {
      console.log(`\n📦 Product: ${product.name} (ID: ${product.id})`);
      console.log(`   Database image_url: ${product.image_url}\n`);

      if (!product.image_url || !product.image_url.includes('supabase.co')) {
        console.log(`   ⚠️  Not a Supabase URL, skipping...`);
        continue;
      }

      // Extract path from URL
      // URL format: https://...supabase.co/storage/v1/object/public/products/PATH
      const urlMatch = product.image_url.match(/\/products\/(.+)$/);
      if (!urlMatch) {
        console.log(`   ❌ Cannot extract path from URL`);
        continue;
      }

      const storagePath = urlMatch[1];
      console.log(`   Extracted storage path: ${storagePath}`);

      // Try to access the file
      const { data: fileData, error: fileError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(storagePath);

      if (fileError) {
        console.log(`   ❌ File NOT accessible: ${fileError.message}`);
        
        // Try alternative paths
        console.log(`   🔍 Trying alternative paths...`);
        
        // Try without "products/" prefix if it exists
        const altPath1 = storagePath.replace(/^products\//, '');
        if (altPath1 !== storagePath) {
          const { error: alt1Error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(altPath1);
          if (!alt1Error) {
            console.log(`   ✅ Found at: ${altPath1}`);
            console.log(`   💡 Fix: Update database URL to use path: ${altPath1}`);
          } else {
            console.log(`   ❌ Not at: ${altPath1}`);
          }
        }

        // Try with "products/" prefix if it doesn't exist
        const altPath2 = storagePath.startsWith('products/') ? storagePath : `products/${storagePath}`;
        if (altPath2 !== storagePath) {
          const { error: alt2Error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(altPath2);
          if (!alt2Error) {
            console.log(`   ✅ Found at: ${altPath2}`);
            console.log(`   💡 Fix: Update database URL to use path: ${altPath2}`);
          } else {
            console.log(`   ❌ Not at: ${altPath2}`);
          }
        }

        // List what's actually in the product folder
        const productFolder = storagePath.split('/')[0];
        console.log(`   📁 Listing files in folder: ${productFolder}`);
        const { data: folderFiles, error: listError } = await supabase.storage
          .from(BUCKET_NAME)
          .list(productFolder, { limit: 10 });

        if (!listError && folderFiles) {
          console.log(`   Found ${folderFiles.length} file(s):`);
          folderFiles.forEach(file => {
            console.log(`      - ${file.name}`);
          });
        } else {
          console.log(`   ❌ Cannot list folder: ${listError?.message || 'Unknown error'}`);
        }

      } else {
        console.log(`   ✅ File IS accessible! (Size: ${fileData.size} bytes)`);
        console.log(`   ✅ URL in database is CORRECT`);
      }
    }

    console.log('\n\n📊 SUMMARY:');
    console.log('===========');
    console.log('If files are NOT accessible:');
    console.log('  1. Check if bucket is PUBLIC in Supabase Dashboard');
    console.log('  2. Verify file paths match between database and storage');
    console.log('  3. Re-upload images if paths are wrong\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

debugImageMismatch();

