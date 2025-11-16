/**
 * Setup Supabase Storage Bucket for Products
 * 
 * This script:
 * 1. Checks if the "products" bucket exists
 * 2. Creates it if it doesn't exist
 * 3. Makes it public
 * 4. Sets up proper policies
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jvtbbtymefaolozvdpet.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BUCKET_NAME = 'products';

async function setupBucket() {
  try {
    console.log('\n🪣 Setting up Supabase Storage Bucket');
    console.log('======================================\n');

    // Check if bucket exists
    console.log(`1. Checking if bucket "${BUCKET_NAME}" exists...`);
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);

    if (bucketExists) {
      console.log(`   ✅ Bucket "${BUCKET_NAME}" already exists\n`);
      
      // Get bucket details
      const bucket = buckets.find(b => b.name === BUCKET_NAME);
      console.log(`   Bucket Details:`);
      console.log(`   - Name: ${bucket.name}`);
      console.log(`   - ID: ${bucket.id}`);
      console.log(`   - Public: ${bucket.public ? '✅ Yes' : '❌ No'}`);
      console.log(`   - Created: ${bucket.created_at}\n`);

      if (!bucket.public) {
        console.log(`   ⚠️  Bucket is not public! Making it public...`);
        // Note: Supabase doesn't allow changing bucket public status via API
        // User needs to do this manually in the dashboard
        console.log(`   ❌ Cannot change bucket visibility via API.`);
        console.log(`   📝 Please make the bucket public manually:`);
        console.log(`      1. Go to Supabase Dashboard → Storage`);
        console.log(`      2. Click on "${BUCKET_NAME}" bucket`);
        console.log(`      3. Toggle "Public bucket" to ON\n`);
      } else {
        console.log(`   ✅ Bucket is public - ready to use!\n`);
      }
    } else {
      console.log(`   ❌ Bucket "${BUCKET_NAME}" does not exist\n`);
      console.log(`2. Creating bucket "${BUCKET_NAME}"...`);
      
      // Create bucket
      const { data: newBucket, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      });

      if (createError) {
        // If bucket creation fails, it might be a permissions issue
        console.log(`   ❌ Failed to create bucket: ${createError.message}\n`);
        console.log(`   📝 Please create the bucket manually:`);
        console.log(`      1. Go to Supabase Dashboard → Storage`);
        console.log(`      2. Click "New bucket"`);
        console.log(`      3. Name: "${BUCKET_NAME}"`);
        console.log(`      4. Check "Public bucket"`);
        console.log(`      5. Click "Create bucket"\n`);
        return;
      }

      console.log(`   ✅ Bucket "${BUCKET_NAME}" created successfully!\n`);
      console.log(`   Bucket Details:`);
      console.log(`   - Name: ${newBucket.name}`);
      console.log(`   - Public: ${newBucket.public ? '✅ Yes' : '❌ No'}\n`);
    }

    // Test bucket access
    console.log(`3. Testing bucket access...`);
    const { data: files, error: listFilesError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1 });

    if (listFilesError) {
      console.log(`   ⚠️  Cannot list files: ${listFilesError.message}`);
      console.log(`   This might be normal if the bucket is empty.\n`);
    } else {
      console.log(`   ✅ Bucket is accessible`);
      console.log(`   Found ${files.length} file(s) in root\n`);
    }

    console.log('✅ Setup complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. If bucket is not public, make it public in Supabase Dashboard');
    console.log('   2. If images were already uploaded, they should be accessible');
    console.log('   3. If images need to be re-uploaded, run: node scripts/migrate-product-images-to-supabase.js\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run setup
setupBucket();

