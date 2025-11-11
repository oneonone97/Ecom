const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MyShop E-commerce API',
      version: '1.0.0',
      description: 'A comprehensive RESTful API for MyShop e-commerce platform built with Node.js, Express, and MongoDB',
      contact: {
        name: 'API Support',
        email: 'support@myshop.com'
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://api.myshop.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            id: {
              type: 'string',
              description: 'The auto-generated id of the user',
            },
            name: {
              type: 'string',
              description: 'The user name',
              maxLength: 50,
            },
            email: {
              type: 'string',
              description: 'The user email',
              format: 'email',
            },
            password: {
              type: 'string',
              description: 'The user password',
              minLength: 6,
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'The user role',
              default: 'user',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the user was created',
            },
          },
        },
        Product: {
          type: 'object',
          required: ['name', 'description', 'price', 'category', 'stock'],
          properties: {
            id: {
              type: 'string',
              description: 'The auto-generated id of the product',
            },
            name: {
              type: 'string',
              description: 'The product name',
              maxLength: 100,
            },
            description: {
              type: 'string',
              description: 'The product description',
              maxLength: 500,
            },
            price: {
              type: 'number',
              description: 'The product price',
              minimum: 0,
            },
            category: {
              type: 'string',
              enum: ['Smartphones', 'Laptops', 'Tablets', 'Accessories', 'Wearables', 'Audio', 'Other'],
              description: 'The product category',
            },
            image: {
              type: 'string',
              description: 'The product image URL',
              default: 'no-image.jpg',
            },
            stock: {
              type: 'number',
              description: 'The product stock quantity',
              minimum: 0,
              default: 0,
            },
            featured: {
              type: 'boolean',
              description: 'Whether the product is featured',
              default: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the product was created',
            },
          },
        },
        Cart: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The auto-generated id of the cart',
            },
            user: {
              type: 'string',
              description: 'The user id who owns the cart',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product: {
                    type: 'string',
                    description: 'The product id',
                  },
                  quantity: {
                    type: 'number',
                    description: 'The quantity of the product',
                    minimum: 1,
                  },
                  price: {
                    type: 'number',
                    description: 'The price of the product at the time of adding to cart',
                  },
                },
              },
            },
            totalAmount: {
              type: 'number',
              description: 'The total amount of the cart',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the cart was created',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the cart was last updated',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The auto-generated id of the order',
            },
            user: {
              type: 'string',
              description: 'The user id who placed the order',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product: {
                    type: 'string',
                    description: 'The product id',
                  },
                  quantity: {
                    type: 'number',
                    description: 'The quantity ordered',
                  },
                  price: {
                    type: 'number',
                    description: 'The price of the product at the time of order',
                  },
                },
              },
            },
            totalAmount: {
              type: 'number',
              description: 'The total amount of the order',
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
              description: 'The order status',
              default: 'pending',
            },
            shippingAddress: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zipCode: { type: 'string' },
                country: { type: 'string' },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the order was created',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the order was last updated',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './controllers/*.js'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};