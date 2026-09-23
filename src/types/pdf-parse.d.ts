declare module "pdf-parse" {
  export interface PdfTextItem {
    str: string;
    /** [scaleX, skewY, skewX, scaleY, x, y] in PDF user space. */
    transform: number[];
    /** Rendered width in PDF user space. */
    width: number;
  }
  export interface PdfPageData {
    getTextContent(options?: {
      normalizeWhitespace?: boolean;
      disableCombineTextItems?: boolean;
    }): Promise<{ items: PdfTextItem[] }>;
  }
  export interface PdfParseOptions {
    /** Renders one page to text; replaces pdf-parse's default renderer. */
    pagerender?: (pageData: PdfPageData) => Promise<string>;
    max?: number;
  }
  export interface PdfParseResult {
    numpages: number;
    text: string;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  export default function pdfParse(
    data: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;
}
