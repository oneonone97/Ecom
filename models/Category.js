const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'Category name is required'
      },
      len: {
        args: [2, 50],
        msg: 'Category name must be between 2 and 50 characters'
      }
    }
  },
  slug: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'Category slug is required'
      },
      is: {
        args: /^[a-z0-9-]+$/,
        msg: 'Slug can only contain lowercase letters, numbers, and hyphens'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Description cannot exceed 500 characters'
      }
    }
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Categories',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  productCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  metaTitle: {
    type: DataTypes.STRING(60),
    allowNull: true
  },
  metaDescription: {
    type: DataTypes.STRING(160),
    allowNull: true
  },
  metaKeywords: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['slug']
    },
    {
      fields: ['parentId']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['sortOrder']
    }
  ],
  hooks: {
    beforeCreate: (category) => {
      if (!category.slug) {
        category.slug = category.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-');
      }
    },
    beforeUpdate: (category) => {
      if (category.changed('name') && !category.changed('slug')) {
        category.slug = category.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-');
      }
    }
  }
});

// Self-referencing association for parent-child relationships
Category.belongsTo(Category, {
  foreignKey: 'parentId',
  as: 'parent'
});

Category.hasMany(Category, {
  foreignKey: 'parentId',
  as: 'children'
});

// Instance methods
Category.prototype.getFullPath = async function() {
  const path = [this.name];
  let currentCategory = this;
  
  while (currentCategory.parentId) {
    const parent = await Category.findByPk(currentCategory.parentId);
    if (parent) {
      path.unshift(parent.name);
      currentCategory = parent;
    } else {
      break;
    }
  }
  
  return path.join(' > ');
};

Category.prototype.getDepth = async function() {
  let depth = 0;
  let currentCategory = this;
  
  while (currentCategory.parentId) {
    const parent = await Category.findByPk(currentCategory.parentId);
    if (parent) {
      depth++;
      currentCategory = parent;
    } else {
      break;
    }
  }
  
  return depth;
};

Category.prototype.getAllChildren = async function() {
  const children = await Category.findAll({
    where: { parentId: this.id },
    include: [{
      model: Category,
      as: 'children',
      include: [{
        model: Category,
        as: 'children'
      }]
    }]
  });
  
  return children;
};

Category.prototype.updateProductCount = async function() {
  // This would typically count products in this category
  // For now, we'll just update the timestamp
  return await this.update({ updatedAt: new Date() });
};

// Class methods
Category.getHierarchy = async function() {
  const categories = await this.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    include: [{
      model: Category,
      as: 'children',
      where: { isActive: true },
      required: false,
      include: [{
        model: Category,
        as: 'children',
        where: { isActive: true },
        required: false
      }]
    }]
  });
  
  // Return only top-level categories (no parent)
  return categories.filter(cat => !cat.parentId);
};

Category.getFlatList = async function() {
  const categories = await this.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    include: [{
      model: Category,
      as: 'parent',
      required: false
    }]
  });
  
  return categories;
};

Category.getTopLevelCategories = async function() {
  return await this.findAll({
    where: { 
      isActive: true,
      parentId: null 
    },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']]
  });
};

Category.findBySlug = async function(slug) {
  return await this.findOne({
    where: { 
      slug,
      isActive: true 
    },
    include: [{
      model: Category,
      as: 'parent',
      required: false
    }, {
      model: Category,
      as: 'children',
      where: { isActive: true },
      required: false
    }]
  });
};

Category.search = async function(searchTerm) {
  return await this.findAll({
    where: {
      isActive: true,
      [sequelize.Op.or]: [
        { name: { [sequelize.Op.like]: `%${searchTerm}%` } },
        { description: { [sequelize.Op.like]: `%${searchTerm}%` } }
      ]
    },
    order: [['name', 'ASC']]
  });
};

Category.getBreadcrumbs = async function(categoryId) {
  const category = await this.findByPk(categoryId, {
    include: [{
      model: Category,
      as: 'parent',
      required: false
    }]
  });
  
  if (!category) {
    return [];
  }
  
  const breadcrumbs = [{
    id: category.id,
    name: category.name,
    slug: category.slug
  }];
  
  let currentCategory = category;
  while (currentCategory.parent) {
    breadcrumbs.unshift({
      id: currentCategory.parent.id,
      name: currentCategory.parent.name,
      slug: currentCategory.parent.slug
    });
    
    currentCategory = await this.findByPk(currentCategory.parent.id, {
      include: [{
        model: Category,
        as: 'parent',
        required: false
      }]
    });
  }
  
  return breadcrumbs;
};

module.exports = Category;