# Fixing Supabase Database Connection for Deployed Apps

## Problem
Your deployed application cannot connect to Supabase database with error:
```
getaddrinfo ENOTFOUND db.jvtbbtymefaolozvdpet.supabase.co
```

## Solution: Use Connection Pooler

The **Connection Pooler** is more reliable for serverless/deployed applications than direct database connections.

## Step 1: Get Connection Pooler URL from Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `jvtbbtymefaolozvdpet`
3. Go to **Settings** → **Database**
4. Scroll to **Connection string** section
5. Select **"Connection pooling"** tab (not "URI" or "Direct connection")
6. Copy the connection string that looks like:
   ```
   postgresql://postgres.jvtbbtymefaolozvdpet:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

## Step 2: Update Your .env File

Replace your current `DATABASE_URL` with the connection pooler URL:

```env
DATABASE_URL=postgresql://postgres.jvtbbtymefaolozvdpet:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

**Important:** 
- Replace `[YOUR-PASSWORD]` with your actual database password
- Replace `[REGION]` with your actual region (e.g., `us-east-1`, `ap-south-1`)
- URL encode special characters in your password if needed

## Step 3: Test the Connection

Run this command to test:
```bash
node scripts/test-db-connection.js
```

## Step 4: Deploy Updated Configuration

Make sure to update the `DATABASE_URL` environment variable in your deployment platform (Vercel, Netlify, etc.) with the new connection pooler URL.

## Alternative: Use the Script

You can also use the automated script:
```bash
node scripts/update-to-pooler-connection.js
```

This script will prompt you for your password and help generate the correct connection string.

## Connection Pooler Ports

- **Port 6543** (Transaction mode): Recommended for most applications
- **Port 5432** (Session mode): For applications requiring session features

## Why This Works

- Connection pooler uses a different DNS hostname that's more reliable
- Better for serverless environments (Vercel, Netlify, AWS Lambda)
- Handles connection pooling automatically
- More stable DNS resolution

## Still Having Issues?

If the connection pooler doesn't work:
1. Verify your database password is correct
2. Check if your Supabase project is active (not paused)
3. Ensure your project region matches the connection string
4. Try creating a new Supabase project in a different region
