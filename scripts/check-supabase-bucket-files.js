/**
 * Check what files are in the Supabase Storage bucket
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jvtbbtymefaolozvdpet.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BUCKET_NAME = 'products';

async function checkBucketFiles() {
  try {
    console.log('\n🔍 Checking Supabase Storage Bucket Files');
    console.log('==========================================\n');

    // List root files
    console.log('1. Root level files:');
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 100 });

    if (rootError) {
      console.log(`   ❌ Error: ${rootError.message}\n`);
    } else {
      console.log(`   Found ${rootFiles.length} items:\n`);
      rootFiles.forEach((file, idx) => {
        console.log(`   ${idx + 1}. ${file.name} (${file.id})`);
        console.log(`      Type: ${file.metadata ? 'file' : 'folder'}`);
        if (file.metadata) {
          console.log(`      Size: ${(file.metadata.size / 1024).toFixed(2)} KB`);
          console.log(`      MIME: ${file.metadata.mimetype || 'N/A'}`);
        }
        console.log();
      });
    }

    // Check for product folders (45, 46, etc.)
    console.log('2. Checking for product folders (45, 46, etc.):');
    const productIds = [45, 46, 47, 48, 49, 72, 73, 74, 75];
    let foundFolders = 0;
    let foundFiles = 0;

    for (const productId of productIds) {
      const { data: files, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(`${productId}`, { limit: 10 });

      if (!error && files && files.length > 0) {
        foundFolders++;
        foundFiles += files.length;
        console.log(`   ✅ Product ${productId}: Found ${files.length} file(s)`);
        files.forEach(file => {
          console.log(`      - ${file.name}`);
        });
      }
    }

    console.log(`\n   Summary: ${foundFolders} product folders found, ${foundFiles} total files\n`);

    // Test a specific image URL
    console.log('3. Testing image URL access:');
    const testUrl = 'https://jvtbbtymefaolozvdpet.supabase.co/storage/v1/object/public/products/45/main.jpg';
    console.log(`   URL: ${testUrl}`);
    
    // Try to get the file
    const { data: fileData, error: fileError } = await supabase.storage
      .from(BUCKET_NAME)
      .download('45/main.jpg');

    if (fileError) {
      console.log(`   ❌ Cannot access: ${fileError.message}`);
      console.log(`   This confirms the bucket is not public or file doesn't exist.\n`);
    } else {
      console.log(`   ✅ File accessible (size: ${fileData.size} bytes)\n`);
    }

    console.log('📝 IMPORTANT:');
    console.log('   The bucket must be PUBLIC for images to be accessible via URLs.');
    console.log('   Go to Supabase Dashboard → Storage → products → Toggle "Public bucket" ON\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkBucketFiles();

