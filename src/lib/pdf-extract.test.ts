import { describe, expect, it } from "vitest";
import {
  extractMetadata,
  parseDataPoints,
  parseNumber,
  parseRow,
  sanitiseFilename,
  splitCells,
} from "./pdf-extract";

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

describe("parseNumber", () => {
  it("parses plain, currency and thousands-separated numbers", () => {
    expect(parseNumber("112.4")).toBe(112.4);
    expect(parseNumber("£1,250")).toBe(1250);
  });

  it("averages ranges", () => {
    expect(parseNumber("100-200")).toBe(150);
    expect(parseNumber("£95 - £105")).toBe(100);
  });

  it("keeps negative numbers negative", () => {
    expect(parseNumber("-2.5")).toBe(-2.5);
  });

  it("rejects text, including text that starts with digits", () => {
    expect(parseNumber("London")).toBeNull();
    expect(parseNumber("Q1 2024")).toBeNull();
    expect(parseNumber("50,000-100,000 sqft")).toBeNull();
  });
});

describe("splitCells", () => {
  it("splits on tabs, pipes and runs of spaces but not single spaces", () => {
    expect(splitCells("London\tOffice | 112.4   £250")).toEqual([
      "London",
      "Office",
      "112.4",
      "£250",
    ]);
    expect(splitCells("North West England  Warehouse")).toEqual([
      "North West England",
      "Warehouse",
    ]);
  });
});

describe("parseRow", () => {
  it("reads a full row", () => {
    const dp = parseRow(["London", "Office", "10,000-25,000 sqft", "112.4", "£250"]);
    expect(dp).toMatchObject({
      region: "London",
      building_type: "Office",
      building_category: "Commercial",
      size_band: "10,000-25,000 sqft",
      min_sqft: 10000,
      max_sqft: 25000,
      index_value: 112.4,
      price_per_sqft: 250,
    });
  });

  it("does not treat the size band as the index value", () => {
    const dp = parseRow(["South West England", "Warehouse", "50,000-100,000 sqft", "118.0"]);
    expect(dp?.index_value).toBe(118);
    expect(dp?.price_per_sqft).toBeNull();
  });

  it("does not match a region from a short fragment", () => {
    const dp = parseRow(["N", "Office", "101.0"]);
    expect(dp?.region).toBeNull();
  });

  it("returns null for rows with too few cells", () => {
    expect(parseRow(["London", "100"])).toBeNull();
  });
});

describe("parseDataPoints", () => {
  it("keeps rows with a region or building type and drops the rest", () => {
    const text = [
      "UK Construction Price Index  Q3 2024",
      "Region  Type  Index  £/sqft",
      "London  Office  112.4  £250",
      "Scotland  Warehouse  104.1  £95",
      "Some footer text  page  3",
    ].join("\n");
    const points = parseDataPoints(text);
    expect(points.map((p) => [p.region, p.building_type, p.index_value])).toEqual([
      ["London", "Office", 112.4],
      ["Scotland", "Warehouse", 104.1],
    ]);
  });
});

describe("extractMetadata", () => {
  it("finds quarter, year, date and title", () => {
    const meta = extractMetadata("Construction Price Index Q2 2023\nPublished 14/08/2023");
    expect(meta).toEqual({
      title: "Construction Price Index Q2 2023",
      quarter: "Q2 2023",
      year: 2023,
      report_date: "14/08/2023",
    });
  });

  it("falls back to a bare year", () => {
    expect(extractMetadata("Annual review 2022").year).toBe(2022);
  });
});
