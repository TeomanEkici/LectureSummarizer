import pdfParse from "pdf-parse";

export async function extractTextFromSlides(buffer: Buffer): Promise<string> {
  // For now we support PDF slide decks. Other formats should be converted to PDF before upload.
  const data = await pdfParse(buffer);
  return data.text ?? "";
}

