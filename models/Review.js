const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Rating must be at least 1'
      },
      max: {
        args: [5],
        msg: 'Rating cannot exceed 5'
      }
    }
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Review title is required'
      },
      len: {
        args: [3, 100],
        msg: 'Title must be between 3 and 100 characters'
      }
    }
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Review comment is required'
      },
      len: {
        args: [10, 1000],
        msg: 'Comment must be between 10 and 1000 characters'
      }
    }
  },
  isVerifiedPurchase: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  helpfulCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  moderatorNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['productId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['rating']
    },
    {
      fields: ['isApproved']
    },
    {
      unique: true,
      fields: ['userId', 'productId'],
      name: 'unique_user_product_review'
    }
  ]
});

// Instance methods
Review.prototype.markAsHelpful = async function() {
  await this.increment('helpfulCount');
  return this.reload();
};

Review.prototype.approve = async function() {
  return await this.update({ isApproved: true });
};

Review.prototype.reject = async function(moderatorNotes = null) {
  return await this.update({ 
    isApproved: false,
    moderatorNotes 
  });
};

// Class methods
Review.getAverageRating = async function(productId) {
  const result = await this.findOne({
    where: { 
      productId,
      isApproved: true 
    },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('rating')), 'averageRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount']
    ],
    raw: true
  });

  return {
    averageRating: result.averageRating ? parseFloat(result.averageRating).toFixed(1) : 0,
    reviewCount: parseInt(result.reviewCount) || 0
  };
};

Review.getRatingDistribution = async function(productId) {
  const distribution = await this.findAll({
    where: { 
      productId,
      isApproved: true 
    },
    attributes: [
      'rating',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['rating'],
    order: [['rating', 'DESC']],
    raw: true
  });

  // Initialize distribution with zeros
  const result = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  distribution.forEach(item => {
    result[item.rating] = parseInt(item.count);
  });

  return result;
};

module.exports = Review;