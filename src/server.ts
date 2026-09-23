// Server entry point for Cloudflare Workers
import type { ServerEntry } from "@tanstack/react-start/server";

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry() {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(
    '<!doctype html><html><body style="font-family: system-ui; padding: 4rem; text-align: center;"><h1>Something went wrong</h1><p>We hit an unexpected error. Please try again or go <a href="/">home</a>.</p></body></html>',
    {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return response;
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
