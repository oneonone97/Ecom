'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Categories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      slug: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Categories',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      image: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      productCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      metaTitle: {
        type: Sequelize.STRING(60),
        allowNull: true
      },
      metaDescription: {
        type: Sequelize.STRING(160),
        allowNull: true
      },
      metaKeywords: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable('Products', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      price_paise: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      sale_price_paise: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      image_url: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'no-image.jpg'
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_new: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_sale: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Products');
    await queryInterface.dropTable('Categories');
  }
};