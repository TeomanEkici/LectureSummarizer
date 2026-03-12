import pdfParse from "pdf-parse";

export async function extractTextFromSlides(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text ?? "";
}
