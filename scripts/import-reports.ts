/**
 * Import report PDFs from a local folder into Supabase.
 *
 *   npm run import-reports -- <folder> --dry-run      # parse only, print what was found
 *   npm run import-reports -- <folder>                # parse and save
 *   npm run import-reports -- <folder> --dump-text    # also write extracted text to import-debug/
 *
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env (not needed for --dry-run).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describeExtracted, extractReport, pdfToText, saveReport } from "../src/lib/ingest.server";

try {
  process.loadEnvFile();
} catch {
  // No .env — fine for --dry-run.
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dumpText = args.includes("--dump-text");
const folder = args.find((a) => !a.startsWith("--"));

if (!folder) {
  console.error("Usage: npm run import-reports -- <folder-of-pdfs> [--dry-run] [--dump-text]");
  process.exit(1);
}

const files = (await readdir(folder)).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
if (files.length === 0) {
  console.error(`No PDFs found in ${folder}`);
  process.exit(1);
}

console.log(`${dryRun ? "Checking" : "Importing"} ${files.length} PDF(s) from ${folder}\n`);
let failures = 0;

for (const file of files) {
  const buffer = await readFile(path.join(folder, file));
  try {
    if (dumpText) {
      await mkdir("import-debug", { recursive: true });
      await writeFile(path.join("import-debug", `${file}.txt`), await pdfToText(buffer));
    }

    const extracted = await extractReport(file, buffer);
    const summary = describeExtracted(extracted);

    if (dryRun) {
      const ok = extracted.kind === "gt_tpi" && extracted.missingRegions.length === 0;
      if (!ok) failures++;
      console.log(`${ok ? "✓" : "✗"} ${file}\n    ${summary}`);
      if (extracted.kind === "gt_tpi") {
        const uk = extracted.report.rows.find((r) => r.region === "UK Average");
        if (uk) {
          const values = uk.forecasts.map((f) => `${f.year}: ${f.changePct ?? "N/A"}%`);
          console.log(`    UK Average ${values.join("  ")}`);
        }
      }
      continue;
    }

    const result = await saveReport(extracted, buffer);
    console.log(
      `✓ ${file}\n    ${summary} → report #${result.reportId}, ${result.dataPoints} rows`,
    );
  } catch (err) {
    failures++;
    console.log(`✗ ${file}\n    ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n${files.length - failures}/${files.length} OK`);
process.exit(failures > 0 ? 1 : 0);
