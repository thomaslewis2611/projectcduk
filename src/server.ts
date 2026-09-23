// Server entry point for Cloudflare Workers
import type { ServerEntry } from "@tanstack/react-start/server-entry";

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
  // Worker bindings (vars/secrets) reach app code via process.env under nodejs_compat.
  async fetch(request: Request) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request);
      return response;
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
