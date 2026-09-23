declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number;
    text: string;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  export default function pdfParse(data: Buffer | Uint8Array): Promise<PdfParseResult>;
}
