import 'dotenv/config';
import { createServer } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const { SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = 'read_products,write_products';
const nonce = randomBytes(16).toString('hex');

const authUrl = `https://${SHOPIFY_STORE}/admin/oauth/authorize?` +
  `client_id=${SHOPIFY_CLIENT_ID}` +
  `&scope=${SCOPES}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${nonce}`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const hmac = url.searchParams.get('hmac');

  if (state !== nonce) {
    res.writeHead(400);
    res.end('State mismatch — possible CSRF attack');
    return;
  }

  // Verify HMAC
  const params = [...url.searchParams.entries()]
    .filter(([key]) => key !== 'hmac')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const digest = createHmac('sha256', SHOPIFY_CLIENT_SECRET).update(params).digest('hex');
  if (digest !== hmac) {
    res.writeHead(400);
    res.end('HMAC validation failed');
    return;
  }

  // Exchange code for access token
  const tokenRes = await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${SHOPIFY_CLIENT_ID}&client_secret=${SHOPIFY_CLIENT_SECRET}&code=${code}`,
  });

  const data = await tokenRes.json();

  if (data.access_token) {
    // Save token to .env
    const envPath = new URL('.env', import.meta.url).pathname;
    let env = readFileSync(envPath, 'utf8');
    env = env.replace(/SHOPIFY_ACCESS_TOKEN=.*/, `SHOPIFY_ACCESS_TOKEN=${data.access_token}`);
    writeFileSync(envPath, env);

    console.log('\nAccess token saved to .env');
    console.log(`Scopes: ${data.scope}`);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Done! Access token saved. You can close this tab.</h1>');
  } else {
    console.error('Error:', data);
    res.writeHead(500);
    res.end('Failed to get access token: ' + JSON.stringify(data));
  }

  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Opening browser for Shopify authorization...\n`);
  console.log(`If it doesn't open, visit:\n${authUrl}\n`);
  execSync(`open "${authUrl}"`);
});
