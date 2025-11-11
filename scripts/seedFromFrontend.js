const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const Product = require('../models/Product');

(async function seedFromFrontend() {
  try {
    console.log('Seeding from frontend products.json...');
    const jsonPath = path.join(__dirname, '..', '..', 'myshopReact', 'my-project', 'src', 'data', 'products.json');
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const products = JSON.parse(raw);

    await sequelize.authenticate();
    await sequelize.sync();

    // Optional: clear existing
    await Product.destroy({ where: {}, truncate: true });

    let created = 0;
    for (const p of products) {
      const price = Number(p?.pricing?.basePrice) || 0;
      const finalPrice = Number(p?.pricing?.finalPrice) || price;
      await Product.create({
        name: p.name,
        description: p.description || p.shortDescription || p.name,
        price_paise: Math.round(price * 100),
        sale_price_paise: finalPrice !== price ? Math.round(finalPrice * 100) : null,
        category: p.category || 'Other',
        image_url: p.images?.main || null,
        stock: Number.isFinite(p?.inventory?.stock) ? p.inventory.stock : 10,
        featured: !!p?.metadata?.isFeatured,
        is_new: !!p?.metadata?.isNew,
        is_sale: !!p?.metadata?.isSale,
      });
      created++;
    }

    console.log(`Created ${created} products.`);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
})();
