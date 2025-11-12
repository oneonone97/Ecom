/**
 * Simple script to seed basic categories for the e-commerce store
 * Usage: node scripts/seed-categories.js
 */

const db = require('../utils/database');
const logger = require('../utils/logger');

const CATEGORIES = [
  {
    name: 'Kitchen',
    slug: 'kitchen',
    description: 'Premium kitchen accessories and tools for modern cooking',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    isActive: true,
    sortOrder: 1,
    productCount: 0
  },
  {
    name: 'Personal Care',
    slug: 'personal-care',
    description: 'Professional personal care products and wellness accessories',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=300&fit=crop',
    isActive: true,
    sortOrder: 2,
    productCount: 0
  },
  {
    name: 'Cleaning',
    slug: 'cleaning',
    description: 'Eco-friendly cleaning solutions and tools for spotless homes',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
    isActive: true,
    sortOrder: 3,
    productCount: 0
  },
  {
    name: 'Drinkware',
    slug: 'drinkware',
    description: 'Elegant drinkware and bar accessories for every occasion',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
    isActive: true,
    sortOrder: 4,
    productCount: 0
  },
  {
    name: 'Religious Items',
    slug: 'religious-items',
    description: 'Sacred religious items and spiritual accessories for daily worship',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
    isActive: true,
    sortOrder: 5,
    productCount: 0
  },
  {
    name: 'Bags',
    slug: 'bags',
    description: 'Stylish and functional bags for every lifestyle need',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop',
    isActive: true,
    sortOrder: 6,
    productCount: 0
  }
];

async function seedCategories() {
  try {
    console.log('\n🚀 SEEDING CATEGORIES');
    console.log('====================');

    let created = 0;
    let existing = 0;

    const now = new Date();

    for (const categoryData of CATEGORIES) {
      try {
        // Add timestamps
        const dataWithTimestamps = {
          ...categoryData,
          createdAt: now,
          updatedAt: now
        };

        // Try to create category - database will handle if it already exists
        const result = await db.categories.create(dataWithTimestamps);
        console.log(`   ✅ Created: ${categoryData.name}`);
        created++;

      } catch (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          console.log(`   ℹ️  Already exists: ${categoryData.name}`);
          existing++;
        } else {
          console.error(`   ❌ Error creating ${categoryData.name}:`, error.message);
        }
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   ✅ Created: ${created} categories`);
    console.log(`   ℹ️  Existing: ${existing} categories`);
    console.log(`   📁 Total: ${created + existing} categories`);

    if (created > 0) {
      console.log('\n🎉 Categories seeded successfully!');
    } else {
      console.log('\nℹ️  All categories already exist.');
    }

  } catch (error) {
    console.error('\n❌ Error seeding categories:', error.message);
    logger.error('Error in seed-categories:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  seedCategories();
}

module.exports = { seedCategories, CATEGORIES };
