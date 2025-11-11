/**
 * Generate Production Secrets
 * 
 * This script generates strong random secrets for production deployment.
 * 
 * Usage:
 * node scripts/generate-production-secrets.js
 */

const crypto = require('crypto');

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('\n🔐 Production Secrets Generator');
console.log('==============================\n');
console.log('Copy these to your production environment variables:\n');

console.log('# Security Secrets (REQUIRED)');
console.log(`JWT_SECRET=${generateSecret(32)}`);
console.log(`SESSION_SECRET=${generateSecret(32)}`);
console.log('');

console.log('# Optional: Additional Secrets');
console.log(`BCRYPT_SALT=${generateSecret(16)}`);
console.log('');

console.log('⚠️  IMPORTANT:');
console.log('   1. Keep these secrets SECURE');
console.log('   2. Never commit them to Git');
console.log('   3. Add them to your hosting platform\'s environment variables');
console.log('   4. Use different secrets for each environment (dev/staging/prod)');
console.log('');

