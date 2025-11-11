/**
 * Test script to verify image gallery implementation
 */

const axios = require('axios');

async function testImageGallery() {
  try {
    console.log('🧪 Testing Image Gallery Implementation\n');
    console.log('='.repeat(80));

    // Test 1: Get products list
    console.log('\n1️⃣ Testing GET /api/products?limit=3\n');
    const response = await axios.get('http://localhost:5000/api/products?limit=3');
    const products = response.data.data;

    if (!products || products.length === 0) {
      console.log('❌ No products returned');
      return;
    }

    console.log(`✅ Retrieved ${products.length} products\n`);

    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (ID: ${p.id})`);
      console.log(`   Category: ${p.category?.name || 'N/A'}`);
      console.log(`   Single image_url: ${p.image_url ? '✅' : '❌'} ${p.image_url ? p.image_url.substring(0, 50) + '...' : 'None'}`);
      
      if (p.image_gallery) {
        console.log(`   Image gallery: ✅ ${p.image_gallery.length} images`);
        console.log(`   Gallery images (first 3):`);
        p.image_gallery.slice(0, 3).forEach((img, idx) => {
          console.log(`      ${idx + 1}. ${img.substring(0, 60)}${img.length > 60 ? '...' : ''}`);
        });
        if (p.image_gallery.length > 3) {
          console.log(`      ... and ${p.image_gallery.length - 3} more images`);
        }
      } else {
        console.log(`   Image gallery: ❌ Not found`);
      }

      if (p.images) {
        const galleryCount = p.images.gallery ? p.images.gallery.length : 0;
        console.log(`   Images object: ✅ ${galleryCount > 0 ? galleryCount + ' images in gallery' : 'No gallery'}`);
      } else {
        console.log(`   Images object: ❌ Not found`);
      }
      console.log('-'.repeat(80));
    });

    // Summary
    console.log('\n📊 Summary:');
    const withGallery = products.filter(p => p.image_gallery && p.image_gallery.length > 1).length;
    const singleImage = products.filter(p => !p.image_gallery || p.image_gallery.length === 1).length;
    const totalImages = products.reduce((sum, p) => sum + (p.image_gallery ? p.image_gallery.length : 1), 0);
    
    console.log(`   Products with multiple images: ${withGallery}/${products.length}`);
    console.log(`   Products with single image: ${singleImage}/${products.length}`);
    console.log(`   Total images across products: ${totalImages}`);
    console.log(`   Average images per product: ${(totalImages / products.length).toFixed(1)}`);

    // Test 2: Get single product
    if (products.length > 0) {
      console.log('\n2️⃣ Testing GET /api/products/:id\n');
      const firstProduct = products[0];
      const singleResponse = await axios.get(`http://localhost:5000/api/products/${firstProduct.id}`);
      const singleProduct = singleResponse.data.data;

      console.log(`✅ Retrieved product: ${singleProduct.name}`);
      if (singleProduct.image_gallery) {
        console.log(`   Image gallery: ✅ ${singleProduct.image_gallery.length} images`);
      } else {
        console.log(`   Image gallery: ❌ Not found`);
      }
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Check frontend - products should show navigation arrows');
    console.log('   2. Swipe/click through images on product cards');
    console.log('   3. Verify all images from folders are displayed');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Backend server is not running!');
      console.error('   Start it with: cd MyShop-backend && npm run dev');
    } else if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 300));
    } else {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testImageGallery();

