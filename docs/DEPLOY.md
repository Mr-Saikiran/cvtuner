# Deploying CVTuner to techswitch.in/cvtuner

The app is a Next.js project in `apps/web`, built with `basePath: "/cvtuner"`. Every page, asset and API route already lives under `/cvtuner`. You deploy it once on Vercel, then make `techswitch.in/cvtuner` forward to it.

## 1. Create the Vercel project

1. In Vercel, choose **Add New → Project** and import `Mr-Saikiran/cvtuner`.
2. Set **Root Directory** to `apps/web`. Vercel then finds Next.js and pnpm on its own. Leave the build and install commands as they are.
3. Deploy. The app opens at `https://<project>.vercel.app/cvtuner`. The bare domain `/` redirects there.

No environment variables are needed for Phase 1.

## 2. Serve it at techswitch.in/cvtuner

Choose the option that matches where techswitch.in is hosted now.

### A. techswitch.in is on Vercel too
Add rewrites to the **techswitch.in** project. For a Next.js site, put them in `next.config`:

```js
async rewrites() {
  return [
    { source: "/cvtuner", destination: "https://<project>.vercel.app/cvtuner" },
    { source: "/cvtuner/:path*", destination: "https://<project>.vercel.app/cvtuner/:path*" },
  ];
}
```

For any other framework, put them in `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/cvtuner", "destination": "https://<project>.vercel.app/cvtuner" },
    { "source": "/cvtuner/:path*", "destination": "https://<project>.vercel.app/cvtuner/:path*" }
  ]
}
```

### B. techswitch.in uses Cloudflare (proxied DNS, orange cloud) — current setup
A ready Worker is in `deploy/cloudflare/`. It forwards only `techswitch.in/cvtuner*` and keeps redirects on techswitch.in.

1. Set `ORIGIN` in `deploy/cloudflare/wrangler.toml` to the Vercel production domain, for example `https://cvtuner.vercel.app`.
2. Deploy it:
   ```bash
   cd deploy/cloudflare
   npx wrangler login     # or set CLOUDFLARE_API_TOKEN
   npx wrangler deploy
   ```
   Or, in the dashboard: go to **Workers & Pages → Create → Worker**, paste `worker.js`, add the variable `ORIGIN`, then add the route `techswitch.in/cvtuner*` (zone techswitch.in) under **Settings → Domains & Routes**.
3. The DNS record for `techswitch.in` must be **proxied** (orange cloud), or the route won't run.

### C. techswitch.in runs on your own server (Nginx)

```nginx
location /cvtuner {
    proxy_pass https://<project>.vercel.app;
    proxy_set_header Host <project>.vercel.app;
    proxy_ssl_server_name on;
}
```

### D. The host can't proxy (some shared or WordPress hosting)
Use a subdomain such as `cvtuner.techswitch.in`. In Vercel, add the domain under **Settings → Domains**, then create the CNAME record Vercel shows. The app still answers at `/cvtuner` on that subdomain.

## 3. Check it

- `https://techswitch.in/cvtuner` loads the app, and the CVTuner icon appears in the browser tab.
- Upload a PDF on the Profile tab. This calls `/cvtuner/api/import`, the only server route.
- On a phone, the app can be added to the home screen (PWA manifest at `/cvtuner/manifest.webmanifest`).
