import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';

const { SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;
let accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

const API_VERSION = '2026-01';
const ENDPOINT = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;

// --- Token management ---

async function refreshToken() {
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
    console.error('Failed to refresh token:', data);
    process.exit(1);
  }

  // Update .env file
  const envPath = new URL('.env', import.meta.url).pathname;
  let env = readFileSync(envPath, 'utf8');
  env = env.replace(/SHOPIFY_ACCESS_TOKEN=.*/, `SHOPIFY_ACCESS_TOKEN=${data.access_token}`);
  writeFileSync(envPath, env);

  accessToken = data.access_token;
  return accessToken;
}

// --- GraphQL helper ---

export async function query(graphql, variables = {}) {
  if (!accessToken) {
    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      console.error('No access token and no client credentials. Run: npm run auth');
      process.exit(1);
    }
    await refreshToken();
  }

  let res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: graphql, variables }),
  });

  // Token expired — refresh and retry once
  if (res.status === 401) {
    await refreshToken();
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: graphql, variables }),
    });
  }

  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

// --- Products ---

async function listProducts() {
  const data = await query(`{
    products(first: 50) {
      nodes {
        id
        title
        status
        totalInventory
        variants(first: 5) {
          nodes { id title price }
        }
      }
    }
  }`);
  const products = data.products.nodes;
  if (!products.length) return console.log('No products found.');
  for (const p of products) {
    console.log(`\n${p.title} (${p.status})`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Inventory: ${p.totalInventory}`);
    for (const v of p.variants.nodes) {
      console.log(`  Variant: ${v.title} — $${v.price}`);
    }
  }
}

async function createProduct(title, price) {
  const data = await query(`
    mutation($input: ProductInput!) {
      productCreate(input: $input) {
        product { id title }
        userErrors { field message }
      }
    }
  `, {
    input: {
      title,
      variants: [{ price }],
    },
  });
  const result = data.productCreate;
  if (result.userErrors.length) {
    console.error('Errors:', result.userErrors);
  } else {
    console.log(`Created: ${result.product.title} (${result.product.id})`);
  }
}

async function deleteProduct(id) {
  const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;
  const data = await query(`
    mutation($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors { field message }
      }
    }
  `, { input: { id: gid } });
  const result = data.productDelete;
  if (result.userErrors.length) {
    console.error('Errors:', result.userErrors);
  } else {
    console.log(`Deleted: ${result.deletedProductId}`);
  }
}

// --- Collections ---

async function listCollections() {
  const data = await query(`{
    collections(first: 50) {
      nodes {
        id
        title
        productsCount { count }
      }
    }
  }`);
  const collections = data.collections.nodes;
  if (!collections.length) return console.log('No collections found.');
  for (const c of collections) {
    console.log(`\n${c.title}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Products: ${c.productsCount.count}`);
  }
}

async function createCollection(title) {
  const data = await query(`
    mutation($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id title }
        userErrors { field message }
      }
    }
  `, { input: { title } });
  const result = data.collectionCreate;
  if (result.userErrors.length) {
    console.error('Errors:', result.userErrors);
  } else {
    console.log(`Created: ${result.collection.title} (${result.collection.id})`);
  }
}

async function addProductToCollection(collectionId, productId) {
  const cid = collectionId.startsWith('gid://') ? collectionId : `gid://shopify/Collection/${collectionId}`;
  const pid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`;
  const data = await query(`
    mutation($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection { id title }
        userErrors { field message }
      }
    }
  `, { id: cid, productIds: [pid] });
  const result = data.collectionAddProducts;
  if (result.userErrors.length) {
    console.error('Errors:', result.userErrors);
  } else {
    console.log(`Added product to ${result.collection.title}`);
  }
}

// --- CLI ---

const [,, resource, action, ...args] = process.argv;

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    } else {
      parsed._positional = parsed._positional || [];
      parsed._positional.push(args[i]);
    }
  }
  return parsed;
}

const opts = parseArgs(args);

const commands = {
  products: {
    list: () => listProducts(),
    create: () => createProduct(opts.title, opts.price || '0'),
    delete: () => deleteProduct(opts._positional?.[0]),
  },
  collections: {
    list: () => listCollections(),
    create: () => createCollection(opts.title),
    'add-product': () => addProductToCollection(opts._positional?.[0], opts._positional?.[1]),
  },
};

const cmd = commands[resource]?.[action];
if (!cmd) {
  console.log(`
Usage:
  node shopify.js products list
  node shopify.js products create --title "Ring" --price 49.99
  node shopify.js products delete <id>
  node shopify.js collections list
  node shopify.js collections create --title "Rings"
  node shopify.js collections add-product <collection-id> <product-id>
  `);
  process.exit(0);
}

cmd();
