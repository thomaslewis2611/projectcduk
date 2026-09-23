/**
 * Server function for uploading a PDF report from the admin UI.
 * The pipeline itself lives in ingest.server.ts (shared with the import script).
 *
 * pdf-parse is Node-only; on Cloudflare Workers it needs replacing with a
 * pure-JS extractor (see BACKLOG 1.3). Until then, import with
 * `npm run import-reports` locally.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin.server";
import { extractReport, saveReport, type IngestResult } from "@/lib/ingest.server";

const uploadInputSchema = z.object({
  accessToken: z.string().min(1),
  filename: z.string().min(1).max(255),
  base64: z.string().min(1),
});

export const uploadAndParseReport = createServerFn({ method: "POST" })
  .validator(uploadInputSchema)
  .handler(async ({ data }): Promise<IngestResult> => {
    await requireAdmin(data.accessToken);
    const buffer = Buffer.from(data.base64, "base64");
    try {
      const extracted = await extractReport(data.filename, buffer);
      return await saveReport(extracted, buffer);
    } catch (err: unknown) {
      console.error("[uploadAndParseReport] Error:", err);
      throw new Error(
        `Failed to process report: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
