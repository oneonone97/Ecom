# Frontend Image Loading Guide

## Backend API Response Format

The backend returns products with the following image fields:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Product Name",
      "image_url": "https://...supabase.co/storage/v1/object/public/products/...",
      "image_gallery": [
        "https://...supabase.co/storage/v1/object/public/products/..."
      ],
      "images": {
        "main": "https://...supabase.co/storage/v1/object/public/products/...",
        "thumbnail": "https://...supabase.co/storage/v1/object/public/products/...",
        "gallery": [
          "https://...supabase.co/storage/v1/object/public/products/..."
        ]
      }
    }
  ]
}
```

## Image Field Priority (Use in this order)

1. **`image_url`** - Primary image URL (always present)
2. **`images.main`** - Main image from gallery
3. **`image_gallery[0]`** - First image from gallery array
4. **`images.gallery[0]`** - First image from images.gallery

## Frontend Implementation

### Recommended Image Component

```jsx
const ProductImage = ({ product }) => {
  // Priority order: image_url > images.main > image_gallery[0] > images.gallery[0]
  const imageUrl = 
    product.image_url || 
    product.images?.main || 
    (product.image_gallery && product.image_gallery[0]) ||
    (product.images?.gallery && product.images.gallery[0]) ||
    '/placeholder.jpg';

  return (
    <img 
      src={imageUrl} 
      alt={product.name}
      onError={(e) => {
        e.target.src = '/placeholder.jpg';
      }}
    />
  );
};
```

### For Image Gallery/Carousel

```jsx
const ProductGallery = ({ product }) => {
  // Get all images
  const images = 
    product.image_gallery || 
    product.images?.gallery || 
    (product.image_url ? [product.image_url] : []);

  return (
    <div className="gallery">
      {images.map((url, index) => (
        <img 
          key={index}
          src={url} 
          alt={`${product.name} - Image ${index + 1}`}
          onError={(e) => {
            e.target.src = '/placeholder.jpg';
          }}
        />
      ))}
    </div>
  );
};
```

## API Endpoints Used by Homepage

The Home page likely calls one of these:

1. **`GET /api/products`** - All products (with pagination)
2. **`GET /api/products/new`** - New products (limit=8)
3. **`GET /api/products/sale`** - Sale products (limit=8)

All endpoints return the same format with `image_url`, `image_gallery`, and `images` fields.

## Troubleshooting

### Images Not Loading?

1. **Check the API response:**
   ```javascript
   console.log('Product:', product);
   console.log('image_url:', product.image_url);
   console.log('image_gallery:', product.image_gallery);
   console.log('images:', product.images);
   ```

2. **Verify image URLs:**
   - Should start with `https://`
   - Should be Supabase Storage URLs
   - Test the URL directly in browser

3. **Check CORS:**
   - Supabase Storage URLs should be publicly accessible
   - No CORS issues if using full URLs

4. **Fallback:**
   - Always provide a placeholder image
   - Use `onError` handler to catch broken images

## Example: Home Page Component

```jsx
import { useEffect, useState } from 'react';
import api from './services/api';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Option 1: Get new products
        const response = await api.get('/api/products/new?limit=8');
        
        // Option 2: Get all products
        // const response = await api.get('/api/products?limit=8');
        
        if (response.data.success) {
          setProducts(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="home">
      <h1>Featured Products</h1>
      <div className="products-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            <img 
              src={
                product.image_url || 
                product.images?.main || 
                '/placeholder.jpg'
              }
              alt={product.name}
              onError={(e) => {
                e.target.src = '/placeholder.jpg';
              }}
            />
            <h3>{product.name}</h3>
            <p>₹{(product.price_paise / 100).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
```

## Key Points

✅ **Always use `image_url` as primary source**  
✅ **Fallback to `images.main` or `image_gallery[0]`**  
✅ **Always include `onError` handler**  
✅ **Use placeholder image as final fallback**  
✅ **Image URLs should be full HTTPS URLs (Supabase Storage)**

