/**
 * Check Supabase Storage Buckets
 * 
 * This script lists all available buckets in your Supabase Storage.
 * 
 * Usage:
 * node scripts/check-supabase-buckets.js
 */

require('dotenv').config();
const { supabase, isConfigured } = require('../utils/supabaseStorage');

async function checkBuckets() {
  try {
    console.log('\n📦 Checking Supabase Storage Buckets');
    console.log('====================================\n');

    if (!isConfigured()) {
      console.error('❌ Supabase Storage is not configured!');
      console.error('   Please set SUPABASE_SERVICE_ROLE_KEY in .env file\n');
      return false;
    }

    console.log('✅ Supabase Storage client initialized\n');

    // List all buckets
    console.log('1. Listing all buckets...');
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      throw new Error(`Failed to list buckets: ${error.message}`);
    }

    if (!buckets || buckets.length === 0) {
      console.log('   ⚠️  No buckets found\n');
      console.log('💡 Create a bucket:');
      console.log('   1. Go to Supabase Dashboard → Storage');
      console.log('   2. Click "New bucket"');
      console.log('   3. Name: products');
      console.log('   4. Public: ✅ YES');
      console.log('   5. Click "Create bucket"\n');
      return false;
    }

    console.log(`   ✅ Found ${buckets.length} bucket(s):\n`);

    buckets.forEach((bucket, index) => {
      const isPublic = bucket.public ? '✅ Public' : '❌ Private';
      const expectedBucket = process.env.SUPABASE_STORAGE_BUCKET || 'products';
      const isExpected = bucket.name === expectedBucket ? ' ⭐ (Expected)' : '';
      
      console.log(`   ${index + 1}. ${bucket.name}`);
      console.log(`      Status: ${isPublic}${isExpected}`);
      console.log(`      Created: ${bucket.created_at || 'N/A'}`);
      console.log(`      ID: ${bucket.id}`);
      console.log('');
    });

    // Check if expected bucket exists
    const expectedBucket = process.env.SUPABASE_STORAGE_BUCKET || 'products';
    const bucketExists = buckets.some(b => b.name === expectedBucket);

    if (bucketExists) {
      const bucket = buckets.find(b => b.name === expectedBucket);
      console.log(`✅ Expected bucket "${expectedBucket}" exists!`);
      
      if (!bucket.public) {
        console.log(`\n⚠️  WARNING: Bucket "${expectedBucket}" is PRIVATE!`);
        console.log('   Images will not be publicly accessible.');
        console.log('   Go to Dashboard → Storage → Buckets → Settings');
        console.log('   Toggle "Public bucket" to ON\n');
      } else {
        console.log(`✅ Bucket "${expectedBucket}" is PUBLIC - ready for uploads!\n`);
      }

      // Try to list files in the bucket
      console.log(`2. Checking files in "${expectedBucket}" bucket...`);
      const { data: files, error: listError } = await supabase.storage
        .from(expectedBucket)
        .list();

      if (listError) {
        console.log(`   ⚠️  Cannot list files: ${listError.message}\n`);
      } else {
        console.log(`   ✅ Found ${files.length} file(s) in bucket\n`);
        if (files.length > 0) {
          console.log('   Files:');
          files.slice(0, 10).forEach(file => {
            console.log(`      - ${file.name} (${(file.metadata?.size / 1024).toFixed(2) || 'N/A'} KB)`);
          });
          if (files.length > 10) {
            console.log(`      ... and ${files.length - 10} more`);
          }
          console.log('');
        }
      }
    } else {
      console.log(`\n❌ Expected bucket "${expectedBucket}" NOT FOUND!\n`);
      console.log('💡 Create the bucket:');
      console.log('   1. Go to Supabase Dashboard → Storage');
      console.log('   2. Click "New bucket"');
      console.log(`   3. Name: ${expectedBucket}`);
      console.log('   4. Public: ✅ YES');
      console.log('   5. Click "Create bucket"\n');
      return false;
    }

    console.log('✅ Bucket check completed!\n');
    return true;

  } catch (error) {
    console.error('\n❌ Check failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check SUPABASE_SERVICE_ROLE_KEY in .env');
    console.error('   2. Verify Supabase project is active');
    console.error('   3. Check internet connection\n');
    return false;
  }
}

// Run check if called directly
if (require.main === module) {
  checkBuckets()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Check script failed:', error);
      process.exit(1);
    });
}

module.exports = checkBuckets;

