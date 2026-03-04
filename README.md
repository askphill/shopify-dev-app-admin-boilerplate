# Shopify Dev App — Admin API Boilerplate

A minimal Node.js CLI for talking to the Shopify Admin GraphQL API via a custom app. Zero framework overhead — just `dotenv` and native `fetch`.

Use this to quickly script product/collection operations, run audits, bulk-update data, or build any Admin API automation.

## Setup

### 1. Create a custom app in the Dev Dashboard

1. Go to [dev.shopify.com](https://dev.shopify.com) → **Apps** → **Create app**
2. Select **Start from Dev Dashboard**, name your app, click **Create**
3. Go to the **Versions** tab and configure:
   - **App URL** — leave as default (`https://example.com` is fine)
   - Uncheck **"Embed app in Shopify admin"** — this is a local CLI tool, not an embedded app
   - **Allowed redirection URL(s)** — add `http://localhost:3000/callback`
   - **Access scopes** — add the scopes you need (e.g. `read_products`, `write_products`)
4. Click **Release** to publish the version
5. Go to the **Settings** tab → copy your **Client ID** and **Client Secret**

### 2. Set distribution and install on your store

1. In the Dev Dashboard, go to your app's **Distribution** tab
2. Select **Custom distribution** (this is a private dev tool, not a public app)
3. Go to the **Home** tab → scroll to **Installs** → click **Install app**
4. Select the store you want to install on → **Install**

### 3. Clone and install

```bash
git clone https://github.com/askphill/shopify-dev-app-admin-boilerplate.git
cd shopify-dev-app-admin-boilerplate
npm install
```

### 4. Configure environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```
SHOPIFY_STORE=your-store.myshopify.com
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_ACCESS_TOKEN=
```

### 5. Authenticate

```bash
npm run auth
```

This starts a local server, opens your browser to authorize the app on your store, and saves the access token to `.env` automatically.

### 6. Verify it works

```bash
node shopify.js products list
```

## Usage

### Built-in commands

```bash
# Products
node shopify.js products list
node shopify.js products create --title "Ring" --price 49.99
node shopify.js products delete <product-id>

# Collections
node shopify.js collections list
node shopify.js collections create --title "Rings"
node shopify.js collections add-product <collection-id> <product-id>
```

IDs can be numeric (`12345`) or full GIDs (`gid://shopify/Product/12345`).

### Using the GraphQL helper in your own scripts

`shopify.js` exports a `query()` function you can import:

```js
import { query } from './shopify.js';

const data = await query(`{
  products(first: 10) {
    nodes { id title }
  }
}`);

console.log(data.products.nodes);
```

With variables:

```js
const data = await query(`
  mutation($input: ProductInput!) {
    productCreate(input: $input) {
      product { id title }
      userErrors { field message }
    }
  }
`, {
  input: { title: 'New Product', variants: [{ price: '29.99' }] },
});
```

### Paginated queries

See `examples/check-categories.js` for the cursor-based pagination pattern:

```js
let cursor = null;
let hasNext = true;

while (hasNext) {
  const afterClause = cursor ? `, after: "${cursor}"` : '';
  const data = await query(`{
    products(first: 50${afterClause}) {
      pageInfo { hasNextPage endCursor }
      nodes { id title }
    }
  }`);

  // process data.products.nodes...

  hasNext = data.products.pageInfo.hasNextPage;
  cursor = data.products.pageInfo.endCursor;
}
```

## Example scripts

| Script | What it does |
|---|---|
| `examples/check-categories.js` | Audits products with missing taxonomy categories |
| `examples/check-collection-seo.js` | Flags collections with missing/short meta descriptions |

Run them with:

```bash
node examples/check-categories.js
```

## Changing scopes

If you need access beyond products (e.g. orders, customers, metafields):

1. Go to the Dev Dashboard → your app → **Versions** tab
2. Update the **Access scopes**
3. Click **Release** to publish a new version
4. Re-install the app on your store (the store owner will be prompted to approve the new scopes)
5. Run `npm run auth` to get a fresh token with the updated scopes

Full list of scopes: https://shopify.dev/docs/api/usage/access-scopes

## Project structure

```
.
├── auth.js          # OAuth flow — opens browser, saves access token to .env
├── shopify.js       # GraphQL helper + CLI commands
├── examples/        # Example scripts you can copy and adapt
├── .env.example     # Template for environment variables
└── package.json
```

## How auth works

1. `auth.js` starts a local server on `localhost:3000`
2. Opens your browser to the Shopify OAuth authorize URL
3. You approve the app on your store
4. Shopify redirects back to `localhost:3000/callback` with a code
5. The script exchanges the code for an access token (with HMAC verification)
6. Token is saved to `.env` — you're done

## Requirements

- Node.js 18+ (uses native `fetch`)
- A Shopify store with the app installed via the [Dev Dashboard](https://dev.shopify.com)
