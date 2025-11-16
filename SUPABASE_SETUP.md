# Supabase Client Setup Guide

## ✅ Setup Complete!

Your application is now configured to use **Supabase JavaScript Client** instead of direct PostgreSQL connections. This provides:

- ✅ **Automatic connection pooling** (no more "ENOTFOUND" errors)
- ✅ **Better reliability in serverless environments** (Vercel, Netlify, etc.)
- ✅ **PostgREST API** handles all connection management
- ✅ **Same database interface** - no code changes needed!

## Environment Variables

### Required for Local Development

Add these to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://jvtbbtymefaolozvdpet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Required for Vercel Deployment

Add these environment variables in **Vercel Dashboard → Settings → Environment Variables**:

1. **SUPABASE_URL**
   - Value: `https://jvtbbtymefaolozvdpet.supabase.co`
   - Get from: Supabase Dashboard → Settings → API → Project URL

2. **SUPABASE_SERVICE_ROLE_KEY**
   - Value: Your service role key (starts with `eyJ...`)
   - Get from: Supabase Dashboard → Settings → API → Project API keys → service_role → Reveal
   - ⚠️ **Keep this secret!** Never expose in client-side code

## How to Get Your Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `jvtbbtymefaolozvdpet`
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## Testing

### Test Local Connection
```bash
node scripts/test-supabase-connection.js
```

### Test Credentials Setup
```bash
node scripts/setup-supabase-credentials.js
```

## How It Works

### Automatic Detection

The application automatically uses Supabase client if:
- `SUPABASE_URL` is set, OR
- `SUPABASE_SERVICE_ROLE_KEY` is set

If not configured, it falls back to direct SQL connection (for backward compatibility).

### Database Interface

The Supabase adapter maintains the **exact same interface** as the direct SQL connection:

```javascript
const db = require('./utils/database');

// All these work the same way:
const user = await db.users.findByPk(1);
const users = await db.users.findAll({ where: { isActive: true } });
const newUser = await db.users.create({ email: 'test@example.com', ... });
await db.users.update(1, { name: 'Updated' });
await db.users.destroy(1);
```

**No code changes needed!** Your existing controllers and services work as-is.

## Benefits

### Before (Direct SQL)
- ❌ DNS resolution issues in serverless (`getaddrinfo ENOTFOUND`)
- ❌ Connection pooling not available
- ❌ "Tenant or user not found" errors
- ❌ Unreliable in Vercel/Netlify

### After (Supabase Client)
- ✅ Automatic connection pooling via PostgREST
- ✅ Reliable DNS resolution
- ✅ Works perfectly in serverless environments
- ✅ Better error handling
- ✅ Same code, better reliability

## Troubleshooting

### "Supabase client not available"
- Check that `SUPABASE_URL` is set in `.env`
- Verify the URL format: `https://[PROJECT-REF].supabase.co`

### "Invalid API key"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Make sure you're using the **service_role** key (not anon key)
- Check that the key hasn't been rotated in Supabase Dashboard

### Connection works locally but fails in Vercel
- Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel environment variables
- Redeploy your application after adding the variables

## Migration Notes

- ✅ **No code changes required** - same database interface
- ✅ **Backward compatible** - falls back to SQL if Supabase not configured
- ✅ **All existing queries work** - same methods, same results
- ✅ **Better for production** - automatic connection pooling

## Next Steps

1. ✅ Supabase client is configured and tested
2. ✅ Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Vercel
3. ✅ Redeploy your application
4. ✅ Your app will now use Supabase client automatically!

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgREST API](https://postgrest.org/)
