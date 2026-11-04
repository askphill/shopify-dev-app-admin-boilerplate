---
name: shopify-app-setup
description: Set up this Shopify Admin API boilerplate end to end with a browser (built-in browser, Claude in Chrome or Chrome DevTools MCP). Creates the app in the Shopify Dev Dashboard, releases a version with scopes, installs it on a store, runs the OAuth flow and verifies API access. Use when someone wants to set up, connect, install or test this app.
---

# Shopify app setup (browser driven)

You set up this repo from zero to a working Admin API token on a real store, using a browser you control, and you ask the user for every decision that is theirs. Do not skip the questions and do not invent answers.

The repo is small. The facts this skill relies on:

- `auth.js` runs an OAuth server on `http://localhost:3000`, redirect URI `http://localhost:3000/callback`, requests the scopes in `SHOPIFY_SCOPES` (default `read_products,write_products`) and writes `SHOPIFY_ACCESS_TOKEN` into `.env`.
- `shopify.js` calls the Admin GraphQL API with that token. `node shopify.js products list` and `node shopify.js collections list` are the read checks.
- `.env.example` lists every variable: `SHOPIFY_STORE`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_ACCESS_TOKEN`.

Read `README.md`, `auth.js` and `.env.example` once before you start, in case they changed since this skill was written. If they disagree with this file, the code wins.

## Ground rules

1. **Always use the Dev Dashboard at `https://dev.shopify.com/dashboard`.** Never use `partners.shopify.com` or the store admin's legacy "Develop apps" screen. If a page redirects you there, go back to the Dev Dashboard.
2. **The user signs in, not you.** If you hit a Shopify login, 2FA, captcha or organization picker, stop, tell the user what is on screen, and wait until they say they are done. Never type passwords or codes.
3. **Read the page before you click.** Shopify renames buttons often. Take a snapshot (accessibility tree or text) of each page, find the control by meaning, and adapt. The labels below are what to look for, not exact strings. Take a screenshot after each major step so you can show the user what happened.
4. **Secrets never leave the machine.** Write the Client secret and access token straight into `.env`. Do not print them in chat, in logs, in commit messages or in PR text. `.env` is gitignored; check that before you write to it.
5. **Ask before anything that cannot be undone or that affects a live store**: installing on a non dev store, writing data, deleting data.

## Step 0: pick the browser

Check which browser tools you have, in this order of preference:

- **Built-in browser** of the Claude app (tools like `mcp__Claude_Browser__*`). Sign-ins persist between sessions.
- **Claude in Chrome** (`mcp__claude-in-chrome__*`). Uses the user's own Chrome and their existing Shopify session.
- **Chrome DevTools MCP** (`mcp__chrome-devtools__*`: `navigate_page`, `take_snapshot`, `click`, `fill`, `take_screenshot`, `wait_for`, `list_pages`, `new_page`).

If none are available, tell the user and offer to walk them through the README manually instead. If you have a skill for the chosen browser, load it first.

Important: the OAuth step in Step 5 opens a URL that must load in a browser where the user is signed in to the store. Use the same browser you used for the dashboard.

## Step 1: interview the user

Ask these up front in one message (use a multiple choice question tool if you have one, otherwise a short numbered list). Offer the default in brackets so the user can just say "defaults".

1. **App name** shown in the Dev Dashboard. [`<repo folder name> admin CLI`]
2. **Store**: the `*.myshopify.com` domain to install on, or "create a new dev store". Ask whether it is a dev store or a live client store.
3. **Scopes** needed. [`read_products,write_products`]. Offer common extras: `read_orders`, `read_customers`, `read_inventory`, `write_inventory`, `read_metaobjects`, `write_metaobjects`, `read_content`, `write_content`. Full list: https://shopify.dev/docs/api/usage/access-scopes
4. **Write test**: may you create one test collection on the store to prove write access? [yes for dev stores, no for live stores]
5. **Shopify organization**, only if the user belongs to more than one (you will see a picker after sign in).

Repeat the answers back in one line and continue. Ask again later only if the page shows something that needs their input.

## Step 2: prepare the repo locally

```bash
node --version        # must be 18 or newer
npm install
test -f .env || cp .env.example .env
grep -qx '.env' .gitignore && echo "env ignored"
```

Fill `SHOPIFY_STORE` and `SHOPIFY_SCOPES` in `.env` now with the user's answers. Leave `SHOPIFY_ACCESS_TOKEN` empty. If a `.env` already exists with values, show the user the variable names that are set (never the values) and ask whether to overwrite or keep them.

## Step 3: create the app in the Dev Dashboard

1. Navigate to `https://dev.shopify.com/dashboard`. Handle sign in per ground rule 2.
2. If there is an organization picker, choose the one the user named.
3. Open **Apps** and click **Create app**. Choose **Start from Dev Dashboard** (not "Start from Shopify CLI"), enter the app name from Step 1, click **Create**.
   - If an app with that name already exists, ask the user whether to reuse it or pick another name.
4. Open the **Versions** tab and create or edit the version:
   - **App URL**: leave the default (`https://example.com` is fine). This is a CLI tool.
   - **Embed app in Shopify admin**: uncheck it.
   - **Allowed redirection URL(s)**: exactly `http://localhost:3000/callback`.
   - **Access scopes**: exactly the scopes from Step 1, comma separated, matching `SHOPIFY_SCOPES` in `.env`. Leave optional scopes empty.
   - Click **Release**. Give the version a name like `v1 setup` if asked and confirm.
5. Verify: the Versions list shows the new version as active/released. Screenshot it.
6. Open the **Settings** tab. Read **Client ID** and **Client secret** (click reveal or copy if needed) and write them into `.env` as `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`. If you can only use the copy button, read the value from the clipboard or ask the user to paste it into `.env` themselves. Confirm to the user that both are set, without showing the secret.

## Step 4: install the app on the store

If the user asked for a **new dev store**: in the Dev Dashboard open **Dev stores** (or **Stores**), click to create a dev store, ask the user for a store name, and use its `*.myshopify.com` domain as `SHOPIFY_STORE`.

Then install:

1. Go to the app's **Home** (overview) page. Find **Distribution**.
   - If it offers **Custom distribution**, choose it, enter the store domain, confirm. This is a one way choice for this app, so confirm with the user first if they did not already agree in Step 1.
   - If the store is a dev store in the same organization, the dashboard may let you install directly without choosing a distribution. That is fine.
2. Find **Installs** and click **Install app**, pick the store, then approve on the store's install screen. The user may need to be signed in to that store; handle it per ground rule 2.
3. Verify: the app appears under Installs for that store, or in the store admin under **Settings > Apps**. Screenshot it.

## Step 5: run OAuth and capture the token

Start the auth server in the background so you can keep driving the browser. `NO_BROWSER=1` stops `auth.js` from opening the system browser, so you open the URL in your own browser instead:

```bash
NO_BROWSER=1 npm run auth
```

1. Copy the authorize URL it prints (`https://<store>/admin/oauth/authorize?...`).
2. Navigate your browser to it. Approve the requested scopes on the Shopify screen.
3. Shopify redirects to `http://localhost:3000/callback`. The page should say **Done! Access token saved.** and the process prints `Access token saved to .env` plus the granted scopes, then exits.
4. Check the granted scopes printed by `auth.js` match what the user asked for. If any are missing, the released version does not include them: go back to Step 3.4, release a new version, reinstall, and run auth again.

If your browser cannot reach `localhost:3000` (for example the browser runs on another machine than the code), tell the user, give them the authorize URL, and ask them to open it on the machine running `auth.js`.

## Step 6: test properly

Run each check and show the user the output (never the token):

```bash
grep -q '^SHOPIFY_ACCESS_TOKEN=.\+' .env && echo "token present"
node shopify.js products list
node shopify.js collections list
```

Both list commands must return data or `No products found.` / `No collections found.` without a GraphQL error.

If the user allowed a write test in Step 1:

```bash
node shopify.js collections create --title "Setup test (safe to delete)"
node shopify.js collections list
```

Confirm the new collection shows up. Then open it in the store admin in the browser (`https://<store>/admin/collections`), screenshot it, and ask the user whether to delete it. Delete it in the admin only if they say yes.

Optionally run the example audits, which are read only:

```bash
node examples/check-collection-seo.js
node examples/check-categories.js
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `redirect_uri is not whitelisted` | The released version lacks `http://localhost:3000/callback`. Fix in Versions, release again. |
| `HMAC validation failed` | Wrong `SHOPIFY_CLIENT_SECRET` in `.env`. Copy it again from Settings. |
| `State mismatch` | An old authorize URL was used. Restart `npm run auth` and use the new URL. |
| `EADDRINUSE :3000` | An earlier auth run is still alive. Stop it and retry. |
| `Access denied for ... field` / missing scope errors | Scope not granted. Add it in Versions, release, reinstall, rerun auth. |
| `[API] Invalid API key or access token` | Token missing or revoked (app uninstalled). Rerun `npm run auth`. |
| Store shows "app not available" or no Install option | Distribution not set for that store, or wrong organization selected. Check the Home page Distribution section. |
| Dashboard looks different from this skill | Shopify changed the UI. Read the page, map it to the intent of the step, and tell the user what differed. |

## Finish

Report back in a few lines:

- App name, store domain, released version and granted scopes.
- Which checks passed (read, write if done).
- Anything left for the user, such as deleting the test collection or rotating a secret.

Never commit `.env`. If you changed scopes, remind the user that `SHOPIFY_SCOPES` in `.env` and the scopes on the released version must stay in sync.
