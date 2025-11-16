/**
 * Verify and fix image URLs - check actual storage structure
 */

require('dotenv').config();
const db = require('../utils/database');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jvtbbtymefaolozvdpet.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BUCKET_NAME = 'products';

async function verifyAndFix() {
  try {
    console.log('\n🔍 Verifying Image URLs');
    console.log('========================\n');

    // Get a sample product
    const product = await db.products.findOne({ id: 45 });
    
    if (!product) {
      console.log('❌ Product not found');
      return;
    }

    console.log(`📦 Product: ${product.name} (ID: ${product.id})`);
    console.log(`   Current URL: ${product.image_url}\n`);

    // Test different path formats
    const testPaths = [
      '45/main.jpg',           // Direct path
      'products/45/main.jpg',  // With products folder
    ];

    console.log('Testing storage paths:\n');
    
    for (const testPath of testPaths) {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(testPath);

      if (!error && data) {
        console.log(`   ✅ FOUND at: ${testPath} (Size: ${data.size} bytes)`);
        
        // Generate correct URL
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(testPath);
        
        console.log(`   ✅ Correct URL: ${urlData.publicUrl}\n`);
        
        // Update database with correct URL
        await db.products.update(product.id, { image_url: urlData.publicUrl });
        console.log(`   ✅ Database updated!\n`);
        
        // Now fix all other products
        console.log('Fixing all other products...\n');
        const allProducts = await db.products.findAll();
        
        let fixed = 0;
        for (const p of allProducts) {
          if (p.id === product.id) continue; // Already fixed
          
          // Generate correct path based on the working format
          const correctPath = testPath.replace('45', p.id.toString());
          const { data: urlData2 } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(correctPath);
          
          await db.products.update(p.id, { image_url: urlData2.publicUrl });
          fixed++;
        }
        
        console.log(`✅ Fixed ${fixed} more products\n`);
        return;
      } else {
        console.log(`   ❌ Not at: ${testPath}`);
      }
    }

    console.log('\n❌ Could not find files in storage');
    console.log('   Files may need to be re-uploaded\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

verifyAndFix();

