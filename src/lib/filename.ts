/** Keep storage keys and DB filenames to a safe, flat character set. */
export function sanitiseFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "");
  return cleaned || "report.pdf";
}
