const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Please add a product name'
      },
      len: {
        args: [1, 100],
        msg: 'Name cannot be more than 100 characters'
      }
    }
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Please add a description'
      },
      len: {
        args: [1, 500],
        msg: 'Description cannot be more than 500 characters'
      }
    }
  },
  price_paise: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Price must be positive'
      }
    }
  },
  sale_price_paise: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: {
        args: [0],
        msg: 'Sale price must be positive'
      }
    }
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Categories', // This is a reference to another model
      key: 'id', // This is the column name of the referenced model
    },
    validate: {
      notEmpty: {
        msg: 'Please add a category'
      }
    }
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'no-image.jpg'
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Stock cannot be negative'
      }
    }
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_new: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_sale: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

const Category = require('./Category');

Product.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category'
});

module.exports = Product;