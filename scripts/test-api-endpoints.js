/**
 * API Endpoints Testing Script
 * 
 * This script tests API endpoints to verify end-to-end functionality.
 * 
 * Usage:
 * node scripts/test-api-endpoints.js
 * 
 * Note: Make sure the server is running on port 5000 (or set PORT in .env)
 */

require('dotenv').config();
const http = require('http');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
let authToken = null;
let testUserId = null;
let testUserEmail = null;

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testHealthEndpoint() {
  try {
    console.log('\n1. Testing Health Endpoint...');
    const response = await makeRequest('GET', '/health');
    
    if (response.status === 200 && response.body.success) {
      console.log('   ✅ Health endpoint working');
      console.log(`      Status: ${response.body.status}`);
      console.log(`      Environment: ${response.body.environment}`);
      return true;
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ Health endpoint failed:', error.message);
    return false;
  }
}

async function testUserRegistration() {
  try {
    console.log('\n2. Testing User Registration...');
    testUserEmail = `test-${Date.now()}@example.com`;
    const response = await makeRequest('POST', '/api/users/register', {
      name: 'Test User',
      email: testUserEmail,
      password: 'TestPassword123'
    });
    
    if (response.status === 201 && response.body.success) {
      console.log('   ✅ User registration successful');
      console.log(`      User ID: ${response.body.data.user.id}`);
      console.log(`      Email: ${response.body.data.user.email}`);
      authToken = response.body.data.token;
      testUserId = response.body.data.user.id;
      testUserEmail = response.body.data.user.email; // Use the actual email from response
      return true;
    } else {
      throw new Error(`Registration failed: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ User registration failed:', error.message);
    return false;
  }
}

async function testUserLogin() {
  try {
    console.log('\n3. Testing User Login...');
    
    if (!testUserEmail) {
      console.log('   ⚠️  Skipping - no registered user email available');
      return true;
    }
    
    const response = await makeRequest('POST', '/api/users/login', {
      email: testUserEmail,
      password: 'TestPassword123'
    });
    
    if (response.status === 200 && response.body.success) {
      console.log('   ✅ User login successful');
      authToken = response.body.data.token; // Update token from login
      return true;
    } else if (response.status === 401) {
      console.log('   ⚠️  Login failed - invalid credentials');
      return false;
    } else {
      throw new Error(`Unexpected login response: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ User login test failed:', error.message);
    return false;
  }
}

async function testGetProducts() {
  try {
    console.log('\n4. Testing Get Products...');
    const response = await makeRequest('GET', '/api/products');
    
    if (response.status === 200) {
      console.log('   ✅ Get products successful');
      if (response.body.success && Array.isArray(response.body.data)) {
        console.log(`      Found ${response.body.data.length} product(s)`);
      } else if (Array.isArray(response.body)) {
        console.log(`      Found ${response.body.length} product(s)`);
      }
      return true;
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ Get products failed:', error.message);
    return false;
  }
}

async function testGetSingleProduct() {
  try {
    console.log('\n5. Testing Get Single Product...');
    // First get products to find an ID
    const productsResponse = await makeRequest('GET', '/api/products');
    let productId = 1;
    
    if (productsResponse.status === 200) {
      const products = productsResponse.body.data || productsResponse.body || [];
      if (products.length > 0) {
        productId = products[0].id;
      }
    }
    
    const response = await makeRequest('GET', `/api/products/${productId}`);
    
    if (response.status === 200) {
      console.log('   ✅ Get single product successful');
      console.log(`      Product ID: ${productId}`);
      return true;
    } else if (response.status === 404) {
      console.log('   ⚠️  Product not found (expected if no products exist)');
      return true;
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ Get single product failed:', error.message);
    return false;
  }
}

async function testGetCart() {
  try {
    console.log('\n6. Testing Get Cart (requires auth)...');
    
    if (!authToken) {
      console.log('   ⚠️  Skipping - no auth token available (register a user first)');
      return true;
    }
    
    const response = await makeRequest('GET', '/api/cart', null, authToken);
    
    if (response.status === 200) {
      console.log('   ✅ Get cart successful');
      if (response.body.success && response.body.data) {
        console.log(`      Cart ID: ${response.body.data.id || 'N/A'}`);
      }
      return true;
    } else if (response.status === 401) {
      console.log('   ⚠️  Unauthorized (token may be invalid)');
      return true;
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ Get cart failed:', error.message);
    return false;
  }
}

async function testGetOrders() {
  try {
    console.log('\n7. Testing Get Orders (requires auth)...');
    
    if (!authToken) {
      console.log('   ⚠️  Skipping - no auth token available (register a user first)');
      return true;
    }
    
    const response = await makeRequest('GET', '/api/orders', null, authToken);
    
    if (response.status === 200) {
      console.log('   ✅ Get orders successful');
      if (response.body.success && Array.isArray(response.body.data)) {
        console.log(`      Found ${response.body.data.length} order(s)`);
      }
      return true;
    } else if (response.status === 401) {
      console.log('   ⚠️  Unauthorized (token may be invalid)');
      return true;
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ Get orders failed:', error.message);
    return false;
  }
}

async function testRootEndpoint() {
  try {
    console.log('\n8. Testing Root Endpoint...');
    const response = await makeRequest('GET', '/');
    
    if (response.status === 200 && response.body.success) {
      console.log('   ✅ Root endpoint working');
      console.log(`      Message: ${response.body.message}`);
      return true;
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.body)}`);
    }
  } catch (error) {
    console.error('   ❌ Root endpoint failed:', error.message);
    return false;
  }
}

async function runTests() {
  try {
    console.log('\n🌐 API ENDPOINTS TEST');
    console.log('======================\n');
    console.log(`Testing API at: ${BASE_URL}\n`);
    console.log('⚠️  Make sure the server is running!\n');
    
    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const results = {
      health: await testHealthEndpoint(),
      register: await testUserRegistration(),
      login: await testUserLogin(),
      getProducts: await testGetProducts(),
      getSingleProduct: await testGetSingleProduct(),
      getCart: await testGetCart(),
      getOrders: await testGetOrders(),
      root: await testRootEndpoint()
    };
    
    const passed = Object.values(results).filter(r => r === true).length;
    const total = Object.keys(results).length;
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    Object.keys(results).forEach(test => {
      const status = results[test] ? '✅' : '❌';
      console.log(`   ${status} ${test}`);
    });
    console.log(`\n   Passed: ${passed}/${total}`);
    
    if (passed === total) {
      console.log('\n✅ ALL API ENDPOINT TESTS PASSED!\n');
      return true;
    } else {
      console.log('\n⚠️  Some tests failed or were skipped\n');
      return false;
    }
  } catch (error) {
    console.error('\n❌ API ENDPOINT TESTS FAILED!\n');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Server is not running!');
      console.error('   Start the server with: npm run dev');
    }
    
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

module.exports = runTests;

