const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const Product = require('../models/Product');
const productImages = require('../../product-images.json');

// Map a subset of 41 known products to categories used in the app
const nameToCategory = (name) => {
  const n = name.toLowerCase();
  if (n.includes('brush') || n.includes('massager')) return 'Personal Care';
  if (n.includes('cloth') || n.includes('scrub') || n.includes('scrubber')) return 'Cleaning';
  if (n.includes('bottle') || n.includes('tumbler') || n.includes('glass')) return 'Drinkware';
  if (n.includes('dhoop') || n.includes('akhand') || n.includes('kalash') || n.includes('daniya') || n.includes('dani')) return 'Religious Items';
  if (n.includes('bag')) return 'Bags';
  if (n.includes('keyboard') || n.includes('mouse') || n.includes('laptop')) return 'Electronics';
  if (n.includes('towel')) return 'Bath & Bedding';
  if (n.includes('jar')) return 'Glassware';
  return 'Kitchen';
};

(async function seed() {
  try {
    console.log('Seeding 41 products from ezyZip...');
    await sequelize.authenticate();
    await sequelize.sync();

    // Clear existing
    await Product.destroy({ where: {}, truncate: true });

    const productNames = Object.keys(productImages); // 41 entries
    let created = 0;
    for (const name of productNames) {
      const images = productImages[name];
      const mainImage = images?.mainImage || null;
      const category = nameToCategory(name);
      // Use nominal prices and stock; can be edited later
      const price = 299 + (created % 6) * 100; // 299,399...
      const isSale = created % 3 === 0;
      const sale = isSale ? price - 50 : null;

      await Product.create({
        name,
        description: `${name} - quality product`,
        price_paise: price * 100,
        sale_price_paise: sale ? sale * 100 : null,
        category,
        image_url: mainImage,
        stock: 20,
        featured: created % 4 === 0,
        is_new: created % 5 === 0,
        is_sale: !!isSale,
      });
      created++;
    }

    console.log(`Created ${created} products.`);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
})();


