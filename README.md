# Shopify Dev App — Admin API Boilerplate

A minimal Node.js CLI for talking to the Shopify Admin GraphQL API via a custom app. Zero framework overhead — just `dotenv` and native `fetch`.

Use this to quickly script product/collection operations, run audits, bulk-update data, or build any Admin API automation.

## Setup

### 1. Create a custom app in the Dev Dashboard

> Legacy "Develop apps" in the Shopify admin is deprecated. All new custom apps must be created through the [Dev Dashboard](https://dev.shopify.com).

1. Go to [dev.shopify.com](https://dev.shopify.com) → **Apps** → **Create app**
2. Select **Start from Dev Dashboard**, name your app, click **Create**
3. Go to the **Versions** tab and configure:
   - **App URL** — use `https://shopify.dev/apps/default-app-home` (this app isn't embedded)
   - **Webhooks API version** — pick the latest
   - **Access scopes** — add the scopes you need (e.g. `read_products`, `write_products`)
4. Click **Release** to publish the version
5. Go to the **Settings** tab → copy your **Client ID** and **Client Secret**

### 2. Install the app on your store

1. In the Dev Dashboard, go to your app's **Home** tab
2. Scroll to **Installs** → click **Install app**
3. Select the store you want to install on → **Install**

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

### 5. Get your access token

```bash
npm run auth
```

This uses the [client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant) — no browser needed. It POSTs your client ID + secret to Shopify and saves the access token to `.env`.

> **Note:** Tokens expire after 24 hours. The `query()` helper in `shopify.js` automatically detects expired tokens and refreshes them, so you don't need to re-run `auth.js` manually.

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
├── auth.js          # Client credentials grant — gets access token
├── shopify.js       # GraphQL helper (with auto-refresh) + CLI commands
├── examples/        # Example scripts you can copy and adapt
├── .env.example     # Template for environment variables
└── package.json
```

## How auth works

This boilerplate uses the [client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant) flow:

1. Your app sends its client ID + secret directly to Shopify
2. Shopify returns an access token (valid for 24 hours)
3. When the token expires, `shopify.js` automatically refreshes it

No browser, no redirect URI, no callback server needed. This works because the app is installed on a store you own.

## Requirements

- Node.js 18+ (uses native `fetch`)
- A Shopify store with the app installed via the [Dev Dashboard](https://dev.shopify.com)
