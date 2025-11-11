/**
 * Test image utility functions directly
 */

const { getImageGallery, getAllProductImages } = require('../utils/imageUtils');

// Test with a known product image URL
const testImageUrls = [
  'products/WATER BOTTLE/water bottle silver banner 2.jpg',
  'products/BAMBOO HAIR BRUSH/bamboo brush banner 1.jpg',
  'products/2 IN 1 FORK/2 in 1 fork angle 2.jpg',
  'products/TOWEL/dark blue towel angle.jpg'
];

console.log('🧪 Testing Image Utility Functions\n');
console.log('='.repeat(80));

testImageUrls.forEach((imageUrl, index) => {
  console.log(`\n${index + 1}. Testing: ${imageUrl}`);
  console.log('-'.repeat(80));
  
  try {
    const gallery = getImageGallery(imageUrl);
    const allImages = getAllProductImages(imageUrl);
    
    console.log(`   ✅ getImageGallery() returned:`);
    console.log(`      Main: ${gallery.main}`);
    console.log(`      Thumbnail: ${gallery.thumbnail}`);
    console.log(`      Gallery count: ${gallery.gallery.length} images`);
    
    console.log(`\n   ✅ getAllProductImages() returned:`);
    console.log(`      Total images: ${allImages.length}`);
    
    if (allImages.length > 1) {
      console.log(`\n   📸 All images found:`);
      allImages.slice(0, 5).forEach((img, i) => {
        console.log(`      ${i + 1}. ${img}`);
      });
      if (allImages.length > 5) {
        console.log(`      ... and ${allImages.length - 5} more`);
      }
    } else {
      console.log(`   ⚠️  Only 1 image found (expected more for testing)`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ Image utility test completed!');
console.log('\n💡 If images are found, the implementation is working correctly.');

