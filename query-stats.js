const sequelize = require('./config/database');
const Product = require('./models/Product');

async function getStats() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    
    // Get total products
    const totalProducts = await Product.count();
    console.log(`\n📦 Total Products: ${totalProducts}`);
    
    // Get distinct categories
    const categories = await Product.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      raw: true
    });
    
    console.log(`\n📂 Total Categories: ${categories.length}`);
    console.log('\nCategories:');
    categories.forEach(cat => console.log(`  - ${cat.category}`));
    
    // Get product count per category
    const categoryStats = await Product.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('category')), 'count']
      ],
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('category')), 'DESC']],
      raw: true
    });
    
    console.log('\n📊 Products per Category:');
    categoryStats.forEach(stat => {
      console.log(`  ${stat.category}: ${stat.count} products`);
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getStats();
