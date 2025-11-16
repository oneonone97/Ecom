/**
 * Script to verify if Supabase Storage bucket is public
 * and test image URL accessibility
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jvtbbtymefaolozvdpet.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBucketPublic() {
  try {
    console.log('🔍 Verifying Supabase Storage Bucket Status\n');
    console.log('='.repeat(60));

    // Get bucket info
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    const productsBucket = buckets.find(b => b.name === 'products');

    if (!productsBucket) {
      console.error('❌ "products" bucket not found!');
      console.log('\n📋 Available buckets:');
      buckets.forEach(b => console.log(`   - ${b.name}`));
      return;
    }

    console.log(`\n📦 Bucket: ${productsBucket.name}`);
    console.log(`   ID: ${productsBucket.id}`);
    console.log(`   Public: ${productsBucket.public ? '✅ YES' : '❌ NO'}`);
    console.log(`   Created: ${productsBucket.created_at}`);

    if (!productsBucket.public) {
      console.log('\n⚠️  BUCKET IS NOT PUBLIC!');
      console.log('\n📝 To make it public:');
      console.log('   1. Go to Supabase Dashboard → Storage');
      console.log('   2. Click on "products" bucket');
      console.log('   3. Toggle "Public bucket" to ON');
      console.log('   4. Save changes');
      return;
    }

    console.log('\n✅ Bucket is public! Testing image URLs...\n');

    // Test a sample image URL
    const testProductId = 45;
    const testImagePath = `products/${testProductId}/main.jpg`;
    
    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(testImagePath);

    const testUrl = urlData.publicUrl;
    console.log(`🧪 Testing URL: ${testUrl}`);

    // Try to fetch the image
    try {
      const response = await fetch(testUrl);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        console.log(`   ✅ Image accessible!`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Size: ${contentLength} bytes`);
      } else {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        if (response.status === 404) {
          console.log(`   ⚠️  File not found at path: ${testImagePath}`);
        }
      }
    } catch (fetchError) {
      console.log(`   ❌ Error fetching image: ${fetchError.message}`);
    }

    // List some files to verify structure
    console.log('\n📁 Checking bucket structure...');
    const { data: files, error: listError } = await supabase.storage
      .from('products')
      .list('products', {
        limit: 5,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.log(`   ⚠️  Could not list files: ${listError.message}`);
    } else if (files && files.length > 0) {
      console.log(`   ✅ Found ${files.length} items in "products" folder`);
      files.slice(0, 3).forEach(file => {
        console.log(`      - ${file.name} (${file.metadata?.size || 'unknown'} bytes)`);
      });
    } else {
      console.log(`   ⚠️  No files found in "products" folder`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Verification complete!');
    console.log('\n💡 If bucket is public and images still don\'t load:');
    console.log('   1. Check that image URLs in database match actual file paths');
    console.log('   2. Verify CORS settings in Supabase Dashboard');
    console.log('   3. Check browser console for CORS or 404 errors');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

verifyBucketPublic();

