const Product = require('../models/Product');
const sequelize = require('../config/database');

async function checkElectronics() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const electronicsProducts = await Product.findAll({
      where: { categoryId: 7 }, // Electronics category ID
      attributes: ['id', 'name', 'categoryId']
    });

    console.log('📱 Products in Electronics category (ID: 7):');
    if (electronicsProducts.length === 0) {
      console.log('   No products found in Electronics category');
    } else {
      electronicsProducts.forEach(product => {
        console.log(`   ${product.name}: Category ID ${product.categoryId}`);
      });
    }

    console.log(`\n📊 Total electronics products: ${electronicsProducts.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkElectronics();
