/**
 * Test Supabase Image Upload
 * 
 * This script tests uploading an image to Supabase Storage and verifies it's accessible.
 * 
 * Usage:
 * node scripts/test-supabase-image-upload.js
 * 
 * Prerequisites:
 * 1. Supabase Storage bucket created (e.g., 'products')
 * 2. SUPABASE_SERVICE_ROLE_KEY set in .env
 * 3. @supabase/supabase-js installed: npm install @supabase/supabase-js
 */

require('dotenv').config();
const { uploadImage, getPublicUrl, isConfigured } = require('../utils/supabaseStorage');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function testImageUpload() {
  try {
    console.log('\n🖼️  Testing Supabase Image Upload');
    console.log('==================================\n');

    // Check if Supabase is configured
    if (!isConfigured()) {
      console.error('❌ Supabase Storage is not configured!');
      console.error('   Please set SUPABASE_SERVICE_ROLE_KEY in .env file\n');
      return false;
    }

    console.log('✅ Supabase Storage client initialized\n');

    // Check for test image
    const testImagePaths = [
      path.join(__dirname, '../uploads/test.jpg'),
      path.join(__dirname, '../uploads/test.png'),
      path.join(__dirname, '../public/test.jpg'),
      path.join(__dirname, '../public/test.png')
    ];

    let testImagePath = null;
    for (const imgPath of testImagePaths) {
      if (fs.existsSync(imgPath)) {
        testImagePath = imgPath;
        break;
      }
    }

    if (!testImagePath) {
      console.log('⚠️  No test image found. Creating a simple test...\n');
      console.log('💡 To test with a real image:');
      console.log('   1. Place an image in: uploads/test.jpg');
      console.log('   2. Run this script again\n');
      
      // Test with bucket listing instead
      console.log('📋 Testing bucket access...');
      const { listFiles } = require('../utils/supabaseStorage');
      try {
        const files = await listFiles('products');
        console.log(`   ✅ Can access 'products' bucket`);
        console.log(`   ✅ Found ${files.length} file(s) in bucket\n`);
        return true;
      } catch (error) {
        console.error('   ❌ Cannot access bucket:', error.message);
        console.error('\n💡 Make sure:');
        console.error('   1. Bucket "products" exists in Supabase Storage');
        console.error('   2. Bucket is set to "Public"');
        console.error('   3. SUPABASE_SERVICE_ROLE_KEY is correct\n');
        return false;
      }
    }

    // Read test image
    console.log('1. Reading test image...');
    const fileBuffer = fs.readFileSync(testImagePath);
    const fileName = path.basename(testImagePath);
    const fileExt = path.extname(testImagePath);
    const contentType = fileExt === '.png' ? 'image/png' : 'image/jpeg';
    
    console.log(`   ✅ Image loaded: ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB)\n`);

    // Upload to Supabase
    console.log('2. Uploading to Supabase Storage...');
    const storagePath = `test-${Date.now()}${fileExt}`;
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'products';
    
    const publicUrl = await uploadImage(
      fileBuffer,
      bucketName,
      storagePath,
      contentType
    );
    
    console.log('   ✅ Upload successful!');
    console.log(`   ✅ Public URL: ${publicUrl}\n`);

    // Verify URL is accessible
    console.log('3. Verifying image is accessible...');
    const url = new URL(publicUrl);
    
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          const contentType = res.headers['content-type'];
          console.log('   ✅ Image is publicly accessible!');
          console.log(`   ✅ Content-Type: ${contentType}`);
          console.log(`   ✅ Status: ${res.statusCode}\n`);
          console.log('✅ All image upload tests passed!\n');
          console.log('📋 Summary:');
          console.log(`   - Bucket: ${bucketName}`);
          console.log(`   - File: ${storagePath}`);
          console.log(`   - URL: ${publicUrl}\n`);
          resolve(true);
        } else {
          console.error(`   ❌ Image not accessible (Status: ${res.statusCode})`);
          resolve(false);
        }
      });

      req.on('error', (error) => {
        console.error('   ❌ Error accessing image:', error.message);
        resolve(false);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        console.error('   ❌ Request timeout');
        resolve(false);
      });
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check SUPABASE_SERVICE_ROLE_KEY in .env');
    console.error('   2. Verify bucket exists in Supabase Dashboard');
    console.error('   3. Ensure bucket is set to "Public"');
    console.error('   4. Check bucket name matches SUPABASE_STORAGE_BUCKET\n');
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testImageUpload()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

module.exports = testImageUpload;

