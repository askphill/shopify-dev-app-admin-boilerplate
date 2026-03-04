# Shopify Dev App — Admin API Boilerplate

A minimal Node.js CLI for talking to the Shopify Admin GraphQL API via a custom app. Zero framework overhead — just `dotenv` and native `fetch`.

Use this to quickly script product/collection operations, run audits, bulk-update data, or build any Admin API automation.

## Setup

### 1. Create a custom app in Shopify

1. Go to your Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**
2. Click **Allow custom app development** if prompted
3. Click **Create an app**, give it a name (e.g. "Dev Scripts")
4. Go to **Configuration** → **Admin API access scopes**
5. Select the scopes you need (at minimum: `read_products`, `write_products`)
6. Click **Save**, then **Install app**
7. Copy the **Client ID** and **Client Secret** from the **API credentials** tab

### 2. Clone and install

```bash
git clone https://github.com/askphill/shopify-dev-app-admin-boilerplate.git
cd shopify-dev-app-admin-boilerplate
npm install
```

### 3. Configure environment

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

### 4. Authenticate

```bash
npm run auth
```

This opens your browser, you approve the app on the store, and the access token is automatically saved to `.env`.

### 5. Verify it works

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

## Adding more scopes

If you need access beyond products (e.g. orders, customers, metafields), edit the `SCOPES` constant in `auth.js`:

```js
const SCOPES = 'read_products,write_products,read_orders,write_metafields';
```

Then re-run `npm run auth` to get a new token with the updated scopes.

Full list of scopes: https://shopify.dev/docs/api/usage/access-scopes

## Project structure

```
.
├── auth.js          # One-time OAuth flow — saves access token to .env
├── shopify.js       # GraphQL helper + CLI commands
├── examples/        # Example scripts you can copy and adapt
├── .env.example     # Template for environment variables
└── package.json
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- A Shopify store with custom app development enabled
