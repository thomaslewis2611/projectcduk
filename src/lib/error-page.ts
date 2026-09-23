export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Error — Project CPD UK</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui; margin: 0; padding: 0; background: #f9fafb; }
    .container { max-width: 480px; margin: 0 auto; padding: 3rem 1rem; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1 style="font-size: 2rem; color: #1e3a8a; margin-bottom: 1rem;">Something went wrong</h1>
    <p style="color: #4b5563; margin-bottom: 1.5rem;">
      We hit an unexpected error. You can head back to the
      <a href="/" style="color: #2563eb;">homepage</a> and try again.
    </p>
  </div>
</body>
</html>`;
}
