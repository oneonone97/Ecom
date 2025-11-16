# Vercel Environment Variables Setup

## ✅ Local Setup Complete!

Your local `.env` file is now configured with Supabase credentials. The connection test passed successfully!

## 📋 Add to Vercel

Go to your **Vercel Dashboard** and add these environment variables:

### Step 1: Go to Environment Variables

1. Open [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add These Variables

Click **Add New** and add each variable:

#### Variable 1: `SUPABASE_URL`
- **Key:** `SUPABASE_URL`
- **Value:** `https://jvtbbtymefaolozvdpet.supabase.co`
- **Environment:** Select all (Production, Preview, Development)

#### Variable 2: `SUPABASE_SERVICE_ROLE_KEY`
- **Key:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dGJidHltZWZhb2xvenZkcGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ4NDUyNywiZXhwIjoyMDc3MDYwNTI3fQ.q3y3j45vz1FusaOxTR6zV9erOZl90MB3NuQTxok8K3I`
- **Environment:** Select all (Production, Preview, Development)
- ⚠️ **Keep this secret!** Never commit to git or expose in client code

### Step 3: Redeploy

After adding the variables:
1. Go to **Deployments** tab
2. Click the **⋯** menu on your latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic deployment

## ✅ What This Fixes

After redeploying with these variables:
- ✅ No more "getaddrinfo ENOTFOUND" errors
- ✅ No more "Tenant or user not found" errors
- ✅ Automatic connection pooling via Supabase client
- ✅ Reliable database connections in serverless environment

## 🔍 Verify It's Working

After redeployment, test your API endpoints. You should see:
- Successful database queries
- No connection errors
- Fast response times

## 📚 Related Documentation

- See `SUPABASE_SETUP.md` for detailed setup information
- See `README.md` for general project documentation

## 🔒 Security Notes

- ✅ Service role key is stored securely in Vercel environment variables
- ✅ Never commit `.env` file to git (already in `.gitignore`)
- ✅ Service role key bypasses Row Level Security - only use server-side
- ✅ For client-side operations, use `SUPABASE_ANON_KEY` instead (if needed)
