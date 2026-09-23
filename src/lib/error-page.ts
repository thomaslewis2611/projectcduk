/** Standalone error page for failures before the app can render (no CSS bundle). */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Error — Pricemark</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #005a37; color: #e2ffc6;
      font-family: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { max-width: 480px; padding: 3rem 1.5rem; text-align: center; }
    p.brand { font-size: 1.25rem; font-weight: 500; margin: 0 0 2.5rem; }
    h1 { font-size: 2.5rem; font-weight: 300; letter-spacing: -0.02em; margin: 0 0 1rem; }
    p { color: rgb(226 255 198 / 0.75); line-height: 1.6; }
    a { display: inline-block; margin-top: 1.5rem; padding: 0.65rem 1.25rem; border-radius: 999px;
      background: #e2ffc6; color: #005a37; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <main>
    <p class="brand">Pricemark</p>
    <h1>Something went wrong</h1>
    <p>We hit an unexpected error. Please try again in a moment.</p>
    <a href="/">Go to the homepage</a>
  </main>
</body>
</html>`;
}
