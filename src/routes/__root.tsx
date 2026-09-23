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

const appCss = new URL("../styles.css", import.meta.url).href;

interface RootContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-cpi-blue">404</h1>
        <p className="mt-2 text-gray-600">Page not found</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-cpi-blue px-6 py-3 text-sm font-medium text-white hover:bg-cpi-blue/90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-cpi-blue">Something went wrong</h1>
        <p className="mt-2 text-gray-600">
          An unexpected error occurred. Try refreshing or go home.
        </p>
        <div className="mt-4 flex gap-2 justify-center">
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="rounded-lg bg-cpi-blue px-6 py-3 text-sm font-medium text-white hover:bg-cpi-blue/90"
          >
            Refresh
          </button>
          <Link
            to="/"
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Go home
          </Link>
        </div>
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
      {
        title: "Project CPD UK — UK Construction Price Index",
      },
      {
        name: "description",
        content:
          "Explore UK construction price data, compare build costs across regions and building types, and ask AI-powered questions.",
      },
    ],
    links: [
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </QueryClientProvider>
  );
}
