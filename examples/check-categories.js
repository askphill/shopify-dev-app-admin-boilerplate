/**
 * Example: Audit products with missing or "Uncategorized" taxonomy categories.
 * Demonstrates paginated queries with cursor-based pagination.
 *
 * Usage: node examples/check-categories.js
 */
import { query } from '../shopify.js';

let cursor = null;
let hasNext = true;
let total = 0;
const uncategorized = [];

while (hasNext) {
  const afterClause = cursor ? `, after: "${cursor}"` : '';
  const data = await query(`{
    products(first: 50, query: "status:active"${afterClause}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        productType
        productCategory { productTaxonomyNode { id name } }
      }
    }
  }`);

  for (const p of data.products.nodes) {
    total++;
    const catName = p.productCategory?.productTaxonomyNode?.name;
    if (!catName || catName === 'Uncategorized') {
      uncategorized.push({
        title: p.title,
        id: p.id,
        productType: p.productType || '(empty)',
        category: catName || '(none)',
      });
    }
  }

  hasNext = data.products.pageInfo.hasNextPage;
  cursor = data.products.pageInfo.endCursor;
}

console.log(`Checked ${total} active products\n`);
console.log(`${uncategorized.length} products with missing category:\n`);
for (const p of uncategorized) {
  console.log(`  ${p.title}`);
  console.log(`    ID: ${p.id}`);
  console.log(`    productType: ${p.productType}`);
  console.log(`    category: ${p.category}`);
}
