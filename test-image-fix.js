/**
 * Test Image Fix - Verify placeholder values are converted correctly
 */

require('dotenv').config();
const db = require('./utils/database');
const { container } = require('./container/serviceRegistration');

async function testImageFix() {
  try {
    console.log('🧪 Testing Image Fix\n');
    console.log('='.repeat(80));
    
    // Test 1: Get products directly from database
    console.log('\n1️⃣ Testing Database Query (Before Enrichment)');
    console.log('-'.repeat(80));
    
    const products = await db.products.findAll({ limit: 5 });
    
    console.log(`✅ Found ${products.length} products\n`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (ID: ${product.id})`);
      console.log(`   Raw image_url from DB: "${product.image_url}"`);
      console.log(`   Type: ${typeof product.image_url}`);
      console.log(`   Is placeholder: ${product.image_url === 'no-image.jpg' || product.image_url === 'placeholder.jpg'}`);
      console.log('');
    });
    
    // Test 2: Test enrichment
    console.log('\n2️⃣ Testing enrichWithImageGallery() (After Enrichment)');
    console.log('-'.repeat(80));
    
    const productRepository = container.resolve('productRepository');
    const enriched = productRepository.enrichWithImageGallery(products);
    
    console.log(`✅ Enriched ${enriched.length} products\n`);
    
    let fixedCount = 0;
    let urlCount = 0;
    let placeholderCount = 0;
    
    enriched.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ✅ image_url: "${product.image_url}"`);
      
      const isPlaceholder = product.image_url === '/placeholder.jpg';
      const isUrl = product.image_url && product.image_url.startsWith('http');
      const isLocalPath = product.image_url && product.image_url.startsWith('/') && !isPlaceholder;
      
      if (isPlaceholder) {
        placeholderCount++;
        console.log(`   📝 Status: ✅ Fixed to placeholder`);
      } else if (isUrl) {
        urlCount++;
        console.log(`   🌐 Status: ✅ Valid Supabase URL`);
      } else if (isLocalPath) {
        console.log(`   📁 Status: Local path`);
      } else {
        fixedCount++;
        console.log(`   ⚠️  Status: Still needs fixing`);
      }
      
      console.log(`   ✅ image_gallery: ${product.image_gallery?.length || 0} images`);
      console.log(`   ✅ images.main: ${product.images?.main ? 'EXISTS' : 'MISSING'}`);
      console.log('');
    });
    
    // Test 3: Test API endpoint simulation
    console.log('\n3️⃣ Testing API Response Format');
    console.log('-'.repeat(80));
    
    const apiResponse = {
      success: true,
      data: enriched.slice(0, 2)
    };
    
    console.log('Sample API Response:');
    console.log(JSON.stringify(apiResponse, null, 2).substring(0, 500) + '...\n');
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total products tested: ${enriched.length}`);
    console.log(`✅ Valid Supabase URLs: ${urlCount}`);
    console.log(`✅ Fixed to placeholder: ${placeholderCount}`);
    console.log(`⚠️  Still need fixing: ${fixedCount}`);
    console.log('');
    
    if (placeholderCount > 0) {
      console.log('✅ SUCCESS: Placeholder values are being converted to "/placeholder.jpg"');
      console.log('   Frontend can now use these images!');
    }
    
    if (urlCount > 0) {
      console.log('✅ SUCCESS: Products with Supabase URLs are working!');
    }
    
    if (fixedCount === 0 && (placeholderCount > 0 || urlCount > 0)) {
      console.log('\n🎉 ALL IMAGES ARE NOW PROPERLY FORMATTED!');
      console.log('   Homepage should display images correctly.');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testImageFix();
