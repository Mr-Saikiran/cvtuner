/**
 * Serves techswitch.in/cvtuner* from the CVTuner Vercel deployment.
 * Route: techswitch.in/cvtuner*  (the rest of techswitch.in is not touched)
 * Set ORIGIN in wrangler.toml to the Vercel production domain.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const publicHost = url.host;
    const origin = new URL(env.ORIGIN);
    url.protocol = origin.protocol;
    url.host = origin.host;

    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", publicHost);
    const res = await fetch(new Request(url, { method: request.method, headers, body: request.body, redirect: "manual" }));

    // keep redirects on techswitch.in instead of bouncing users to *.vercel.app
    const location = res.headers.get("Location");
    if (location) {
      const out = new Response(res.body, res);
      out.headers.set("Location", location.replace(origin.origin, `https://${publicHost}`));
      return out;
    }
    return res;
  },
};
