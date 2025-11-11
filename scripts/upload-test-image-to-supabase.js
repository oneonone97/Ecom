/**
 * Upload Test Image to Supabase Storage
 * 
 * This script uploads a test image from your existing product images to Supabase Storage.
 * 
 * Usage:
 * node scripts/upload-test-image-to-supabase.js
 */

require('dotenv').config();
const { uploadImage, getPublicUrl, isConfigured } = require('../utils/supabaseStorage');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function uploadTestImage() {
  try {
    console.log('\n🖼️  Uploading Test Image to Supabase Storage');
    console.log('==============================================\n');

    if (!isConfigured()) {
      console.error('❌ Supabase Storage is not configured!');
      console.error('   Please set SUPABASE_SERVICE_ROLE_KEY in .env file\n');
      return false;
    }

    console.log('✅ Supabase Storage client initialized\n');

    // Find a test image from existing products
    const productImagesPath = path.join(__dirname, '../../myshopReact/my-project/public/products');
    const testFolders = ['WATER BOTTLE', '2 IN 1 FORK', 'CAKE PIE SERVER'];
    
    let testImagePath = null;
    let testImageName = null;
    
    for (const folder of testFolders) {
      const folderPath = path.join(productImagesPath, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath).filter(f => 
          f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png')
        );
        if (files.length > 0) {
          testImagePath = path.join(folderPath, files[0]);
          testImageName = files[0];
          break;
        }
      }
    }

    if (!testImagePath || !fs.existsSync(testImagePath)) {
      console.error('❌ No test image found in product folders');
      console.error('   Expected location: myshopReact/my-project/public/products/[FOLDER]/[image].jpg\n');
      return false;
    }

    console.log(`📸 Found test image: ${testImageName}`);
    console.log(`   Path: ${testImagePath}\n`);

    // Read image file
    console.log('1. Reading image file...');
    const fileBuffer = fs.readFileSync(testImagePath);
    const fileSize = (fileBuffer.length / 1024).toFixed(2);
    const fileExt = path.extname(testImagePath).toLowerCase();
    const contentType = fileExt === '.png' ? 'image/png' : 'image/jpeg';
    
    console.log(`   ✅ Image loaded: ${fileSize} KB`);
    console.log(`   ✅ Content-Type: ${contentType}\n`);

    // Upload to Supabase
    console.log('2. Uploading to Supabase Storage...');
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'products';
    const storagePath = `test/${testImageName}`;
    
    const publicUrl = await uploadImage(
      fileBuffer,
      bucketName,
      storagePath,
      contentType
    );
    
    console.log('   ✅ Upload successful!');
    console.log(`   ✅ Storage path: ${storagePath}`);
    console.log(`   ✅ Public URL: ${publicUrl}\n`);

    // Verify URL is accessible
    console.log('3. Verifying image is accessible...');
    const url = new URL(publicUrl);
    
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          const contentType = res.headers['content-type'];
          const contentLength = res.headers['content-length'];
          console.log('   ✅ Image is publicly accessible!');
          console.log(`   ✅ Status: ${res.statusCode}`);
          console.log(`   ✅ Content-Type: ${contentType}`);
          console.log(`   ✅ Size: ${(contentLength / 1024).toFixed(2)} KB\n`);
          
          console.log('✅ All image upload tests passed!\n');
          console.log('📋 Summary:');
          console.log(`   - Bucket: ${bucketName}`);
          console.log(`   - File: ${storagePath}`);
          console.log(`   - URL: ${publicUrl}\n`);
          console.log('💡 Next Steps:');
          console.log('   1. Check Supabase Dashboard → Storage → products bucket');
          console.log('   2. You should see the uploaded image');
          console.log('   3. Click on the image to view it');
          console.log('   4. Copy the URL and use it in your database\n');
          
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
    console.error('\n❌ Upload failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check SUPABASE_SERVICE_ROLE_KEY in .env');
    console.error('   2. Verify bucket "products" exists in Supabase Dashboard');
    console.error('   3. Ensure bucket is set to "Public"');
    console.error('   4. Check bucket name matches SUPABASE_STORAGE_BUCKET\n');
    return false;
  }
}

// Run upload if called directly
if (require.main === module) {
  uploadTestImage()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Upload script failed:', error);
      process.exit(1);
    });
}

module.exports = uploadTestImage;

