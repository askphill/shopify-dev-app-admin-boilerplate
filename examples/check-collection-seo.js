/**
 * Example: Audit collection SEO meta descriptions.
 * Flags collections with missing or short (<50 chars) descriptions.
 *
 * Usage: node examples/check-collection-seo.js
 */
import { query } from '../shopify.js';

let cursor = null;
let hasNext = true;
const good = [];
const bad = [];

while (hasNext) {
  const afterClause = cursor ? `, after: "${cursor}"` : '';
  const data = await query(`{
    collections(first: 50${afterClause}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        seo { title description }
        productsCount { count }
      }
    }
  }`);

  for (const c of data.collections.nodes) {
    const desc = c.seo?.description?.trim();
    const entry = {
      title: c.title,
      id: c.id,
      products: c.productsCount.count,
      seoTitle: c.seo?.title || '(none)',
      seoDescription: desc || '(none)',
    };

    if (!desc || desc.length < 50) {
      entry.reason = !desc ? 'missing' : `too short (${desc.length} chars)`;
      bad.push(entry);
    } else {
      good.push(entry);
    }
  }

  hasNext = data.collections.pageInfo.hasNextPage;
  cursor = data.collections.pageInfo.endCursor;
}

console.log(`=== GOOD meta descriptions (${good.length}) ===\n`);
for (const c of good) {
  console.log(`  ${c.title} (${c.seoDescription.length} chars)`);
  console.log(`    "${c.seoDescription.slice(0, 120)}${c.seoDescription.length > 120 ? '...' : ''}"`);
}

console.log(`\n=== MISSING or WEAK meta descriptions (${bad.length}) ===\n`);
for (const c of bad) {
  console.log(`  ${c.title} — ${c.reason}`);
  if (c.seoDescription !== '(none)') console.log(`    "${c.seoDescription}"`);
}
