# Static hosting on Plesk

This application is a static site. Serve it only from `https://scratch.xplorers360.com`, an HTTPS
origin separate from the authenticated LMS at `https://lms.algorithmicsespana.com`.

## DNS and Plesk

1. Add an `A` record for `scratch.xplorers360.com` pointing to the public IP of the existing VPS.
   Add an `AAAA` record only if that VPS is configured to serve this host over IPv6. Do not change
   the domain's mail records.
2. In Plesk, add `scratch.xplorers360.com` as its own subdomain/site, with a separate document root
   and no application proxy, login, or shared authentication. Disable PHP and Node.js for this
   static site.
3. Issue a Let's Encrypt certificate for the hostname and enable an HTTP-to-HTTPS redirect.
4. Build the runtime and upload the **contents** of `dist/` and
   [`deployment/.htaccess`](./.htaccess) to the site's document root. `index.html` should be at
   the document root. Do not upload source control metadata, `node_modules`, or `.env` files.
5. Ensure the response headers in `.htaccess` are applied. If nginx serves static files without
passing them through Apache, use
[`plesk-nginx-headers.conf`](./plesk-nginx-headers.conf) under Plesk's additional nginx
directives instead, and avoid setting a second, conflicting CSP.
6. Set `NEXT_PUBLIC_SCRATCH_RUNTIME_URL=https://scratch.xplorers360.com/` in the LMS environment
   and redeploy the LMS. Keep the runtime hostname outside the LMS authentication-cookie scope.

## Response header behavior

The CSP allows only the LMS as a frame ancestor, blocks plugins and form submissions, and permits
`'unsafe-eval'` only on this isolated Scratch origin because the official editor bundle requires
it. The policy allows the Scratch asset host and the Google Fonts origins used by the runtime.
Do not weaken the LMS CSP to make this editor work.

## Verify the deployment

Check that the runtime is served over HTTPS, that no session cookie is set, and that all security
headers are present:

```sh
curl -sSI https://scratch.xplorers360.com/
```

The response should include `Content-Security-Policy`, `Permissions-Policy`,
`X-Content-Type-Options`, and `Referrer-Policy`, and should not include `Set-Cookie`. Then open a
Scratch project from the LMS and verify that the editor loads, saves, and reopens it. Check the
browser console for CSP violations; do not add broad origins to `connect-src` as a workaround.
