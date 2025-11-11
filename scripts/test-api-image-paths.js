/**
 * Test actual API response for Kitchen and Personal Care products
 */

const axios = require('axios');

async function testAPIImagePaths() {
  try {
    console.log('🧪 Testing API Image Paths for Kitchen & Personal Care\n');
    console.log('='.repeat(100));

    // Test Kitchen products
    console.log('\n📁 KITCHEN PRODUCTS API TEST:\n');
    const kitchenResponse = await axios.get('http://localhost:5000/api/products?category=Kitchen&limit=2');
    const kitchenProducts = kitchenResponse.data.data;

    kitchenProducts.forEach((product, i) => {
      console.log(`${i + 1}. ${product.name} (ID: ${product.id})`);
      console.log(`   image_url: ${product.image_url}`);
      console.log(`   image_gallery: ${product.image_gallery ? product.image_gallery.length + ' images' : 'null'}`);
      
      if (product.image_gallery && product.image_gallery.length > 0) {
        console.log(`   First 3 gallery paths:`);
        product.image_gallery.slice(0, 3).forEach((url, idx) => {
          const hasLeadingSlash = url.startsWith('/');
          const status = hasLeadingSlash ? '✅' : '❌';
          console.log(`      ${idx + 1}. ${status} ${url}`);
        });
      }
      
      if (product.images) {
        console.log(`   images.main: ${product.images.main || 'null'}`);
        console.log(`   images.gallery: ${product.images.gallery ? product.images.gallery.length + ' images' : 'null'}`);
        if (product.images.gallery && product.images.gallery.length > 0) {
          const firstImg = product.images.gallery[0];
          const hasLeadingSlash = firstImg.startsWith('/');
          console.log(`   First gallery image: ${hasLeadingSlash ? '✅' : '❌'} ${firstImg}`);
        }
      }
      console.log('-'.repeat(100));
    });

    // Test Personal Care products
    console.log('\n📁 PERSONAL CARE PRODUCTS API TEST:\n');
    const personalCareResponse = await axios.get('http://localhost:5000/api/products?category=Personal Care&limit=2');
    const personalCareProducts = personalCareResponse.data.data;

    personalCareProducts.forEach((product, i) => {
      console.log(`${i + 1}. ${product.name} (ID: ${product.id})`);
      console.log(`   image_url: ${product.image_url}`);
      console.log(`   image_gallery: ${product.image_gallery ? product.image_gallery.length + ' images' : 'null'}`);
      
      if (product.image_gallery && product.image_gallery.length > 0) {
        console.log(`   First 3 gallery paths:`);
        product.image_gallery.slice(0, 3).forEach((url, idx) => {
          const hasLeadingSlash = url.startsWith('/');
          const status = hasLeadingSlash ? '✅' : '❌';
          console.log(`      ${idx + 1}. ${status} ${url}`);
        });
      }
      
      if (product.images) {
        console.log(`   images.main: ${product.images.main || 'null'}`);
        console.log(`   images.gallery: ${product.images.gallery ? product.images.gallery.length + ' images' : 'null'}`);
        if (product.images.gallery && product.images.gallery.length > 0) {
          const firstImg = product.images.gallery[0];
          const hasLeadingSlash = firstImg.startsWith('/');
          console.log(`   First gallery image: ${hasLeadingSlash ? '✅' : '❌'} ${firstImg}`);
        }
      }
      console.log('-'.repeat(100));
    });

    console.log('\n✅ API Test completed!');
    console.log('\n💡 Check if all paths start with "/" - they should for frontend to work correctly.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Backend server is not running!');
      console.error('   Start it with: cd MyShop-backend && npm run dev');
    } else if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 300));
    }
    process.exit(1);
  }
}

testAPIImagePaths();

