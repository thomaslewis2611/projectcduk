import { describe, expect, it } from "vitest";
import { sanitiseFilename } from "./filename";

describe("sanitiseFilename", () => {
  it("keeps ordinary names", () => {
    expect(sanitiseFilename("BCIS_Q3-2024.pdf")).toBe("BCIS_Q3-2024.pdf");
  });

  it("strips directories and path traversal", () => {
    expect(sanitiseFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitiseFilename("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
  });

  it("replaces unsafe characters and leading dots", () => {
    expect(sanitiseFilename("Q3 2024 (final).pdf")).toBe("Q3_2024_final_.pdf");
    expect(sanitiseFilename(".hidden.pdf")).toBe("hidden.pdf");
  });

  it("never returns an empty name", () => {
    expect(sanitiseFilename("...")).toBe("report.pdf");
  });
});
