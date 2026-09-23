/**
 * Root route — defines the HTML shell for the application.
 *
 * This file follows the TanStack Start pattern: it sets up the root route
 * context, HTML shell, and shared layout.
 */
import {
  createRootRouteWithContext,
  Outlet,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import appCss from "../styles.css?url";

interface RootContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="page text-center py-24">
      <p className="eyebrow mb-3">404</p>
      <h1 className="display text-4xl">Page not found</h1>
      <Link to="/" className="btn btn-primary mt-6">
        Go home
      </Link>
    </div>
  );
}

function ErrorComponent() {
  return (
    <div className="page text-center py-24">
      <p className="eyebrow mb-3">Error</p>
      <h1 className="display text-4xl">Something went wrong</h1>
      <p className="mt-3 text-muted">An unexpected error occurred. Try refreshing, or go home.</p>
      <div className="mt-6 flex gap-3 justify-center">
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          Refresh
        </button>
        <Link to="/" className="btn btn-outline">
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RootContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      { title: "Pricemark — UK tender price inflation forecasts" },
      {
        name: "description",
        content:
          "Regional UK construction tender price inflation forecasts from leading cost consultants, tracked report by report, with an escalation calculator.",
      },
      { name: "theme-color", content: "#005a37" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </QueryClientProvider>
  );
}
