# Portfolio chatbot — Cloudflare Worker

Small proxy that lets the site's chatbot call Claude without ever exposing an
API key to the browser. The static site (GitHub Pages) calls this Worker's
URL; the Worker calls `api.anthropic.com` using a key that only exists as a
Cloudflare secret.

## One-time setup

1. Install the CLI (from this `worker/` directory):
   ```
   npm install
   ```
2. Log in to Cloudflare (opens a browser):
   ```
   npx wrangler login
   ```
3. Get an Anthropic API key from https://console.anthropic.com/settings/keys
   and, while you're there, set a monthly spend limit on the account/workspace
   — this Worker rate-limits by request shape, not by dollars, so a spend cap
   is your real backstop against a runaway bill.
4. Store the key as an encrypted Worker secret (you'll be prompted to paste
   it — it is never written to a file or to git):
   ```
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

## Deploy

```
npx wrangler deploy
```

This prints the Worker's URL, e.g. `https://portfolio-chatbot.<your-subdomain>.workers.dev`.
Copy it into `CHATBOT_API_URL` near the top of `assets/js/script.js`.

## Local dev

```
npx wrangler dev
```

Wrangler will prompt for the secret locally too (or create a `.dev.vars` file
with `ANTHROPIC_API_KEY=...` — this file is already in `.gitignore`, **never**
commit it).

## Security notes

- **The API key lives only as a Cloudflare secret.** It's not in
  `wrangler.toml`, not in git, not returned in any response body.
- **CORS/origin allowlist** (`ALLOWED_ORIGINS` in `src/index.js`) restricts
  which sites can call this Worker. Update it if you add a preview domain.
- **Upstream errors are not forwarded verbatim** — Anthropic error responses
  can contain account-identifying details, so the Worker returns a generic
  `502`/`500` instead of relaying `anthropicRes.body`.
- **Message length and history size are capped** (`MAX_MESSAGE_LENGTH`,
  `MAX_HISTORY_MESSAGES`) and `max_tokens` is capped at the Worker level, so a
  single request can't balloon cost.
- **Origin checking is not a strong auth boundary** — a non-browser client
  can spoof the `Origin` header. For real abuse resistance (someone hitting
  the Worker directly at volume), add a Cloudflare **Rate Limiting rule** in
  the dashboard (Workers & Pages → your worker → Triggers/Security, or
  Cloudflare → Rate Limiting Rules) scoped to this route. That's
  dashboard-configured, not code, and stacks on top of everything here.
