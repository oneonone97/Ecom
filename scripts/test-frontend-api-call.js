const axios = require('axios');

async function testFrontendAPICall() {
  try {
    // Test what the frontend is actually calling
    // The frontend passes category name, but backend expects category ID
    
    console.log('🔍 Testing Frontend API Call Simulation\n');
    
    // First, get all categories to map names to IDs
    const categoriesResponse = await axios.get('http://localhost:5000/api/products/categories');
    const categories = categoriesResponse.data.data;
    
    console.log('📋 Available Categories:');
    categories.forEach(cat => {
      console.log(`   ${cat.name} (ID: ${cat.id}, slug: ${cat.slug})`);
    });
    
    console.log('\n🧪 Testing different API calls:\n');
    
    // Test 1: What frontend currently calls (by name - this fails)
    console.log('1. Frontend call (by name - FAILS):');
    try {
      const response1 = await axios.get('http://localhost:5000/api/products?category=Kitchen');
      console.log('   Result:', response1.data.pagination.totalItems, 'products');
    } catch (error) {
      console.log('   Error:', error.message);
    }
    
    // Test 2: Correct call (by ID - this works)
    console.log('\n2. Correct call (by ID - WORKS):');
    const response2 = await axios.get('http://localhost:5000/api/products?category=1');
    console.log('   Result:', response2.data.pagination.totalItems, 'products');
    
    // Test 3: Alternative - call by slug (if we implement it)
    console.log('\n3. Potential solution - call by slug:');
    // This would require backend modification to accept slug
    
    console.log('\n💡 SOLUTION:');
    console.log('   The frontend needs to either:');
    console.log('   a) Use category ID instead of category name');
    console.log('   b) Backend needs to accept category name/slug');
    console.log('   c) Frontend needs to map category names to IDs');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFrontendAPICall();
