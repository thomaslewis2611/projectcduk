// Server entry point for Cloudflare Workers
import type { ServerEntry } from "@tanstack/react-start/server-entry";
import { renderErrorPage } from "./lib/error-page";

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
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
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
