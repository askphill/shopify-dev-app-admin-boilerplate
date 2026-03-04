import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';

const { SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;

if (!SHOPIFY_STORE || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
  console.error('Missing env vars. Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

// Client credentials grant — no browser needed
// Docs: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
const res = await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SHOPIFY_CLIENT_ID,
    client_secret: SHOPIFY_CLIENT_SECRET,
  }),
});

const data = await res.json();

if (!data.access_token) {
  console.error('Failed to get access token:', data);
  process.exit(1);
}

// Save token to .env
const envPath = new URL('.env', import.meta.url).pathname;
let env = readFileSync(envPath, 'utf8');

if (env.includes('SHOPIFY_ACCESS_TOKEN=')) {
  env = env.replace(/SHOPIFY_ACCESS_TOKEN=.*/, `SHOPIFY_ACCESS_TOKEN=${data.access_token}`);
} else {
  env += `\nSHOPIFY_ACCESS_TOKEN=${data.access_token}\n`;
}

writeFileSync(envPath, env);

console.log('Access token saved to .env');
console.log(`Scopes: ${data.scope}`);
console.log(`Expires in: ${Math.round(data.expires_in / 3600)} hours`);
