/**
 * imageOcrParser.ts
 *
 * Uses Gemini Vision (via the existing /api/ai/generate proxy) to extract
 * readable text from an image file. Returns the result in the same
 * { pageNumber, text }[] shape used by the PDF/DOCX parsers so that
 * image documents are stored identically to text documents.
 */
import { IMAGE_OCR_SYSTEM_PROMPT } from "@/lib/gemini";

/**
 * Convert a File/Blob to a base64-encoded string (no data-URI prefix).
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Extract all readable text from a single image file using Gemini Vision.
 *
 * @param file        An image File (PNG / JPEG / WEBP).
 * @param pageNumber  The page number to assign in the resulting pages array (default 1).
 * @returns           A one-element array: [{ pageNumber, text }]
 */
export async function extractTextFromImage(
  file: File,
  pageNumber = 1
): Promise<{ pageNumber: number; text: string }[]> {
  const base64Data = await fileToBase64(file);

  // Determine MIME type — fall back to image/jpeg for unknown types
  const mimeType =
    file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";

  const apiBase = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? ""
    : "https://ssracudex-963945863708.us-central1.run.app";

  const response = await fetch(`${apiBase}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: IMAGE_OCR_SYSTEM_PROMPT,
      // Multimodal: image inlineData first, then a brief text instruction
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: "Transcribe all text visible in this image. Follow the instructions exactly.",
        },
      ],
      generationConfig: {
        temperature: 0.1,
        // OCR output is plain text — override the default JSON mime type
        responseMimeType: "text/plain",
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Image OCR failed (HTTP ${response.status}): ${errBody || "Unknown error"}`
    );
  }

  const data = await response.json();
  const extractedText: string = data.text || "";

  if (!extractedText.trim()) {
    // Return a placeholder — user can still set chapter ranges
    return [{ pageNumber, text: "[No readable text found in this image]" }];
  }

  return [{ pageNumber, text: extractedText.trim() }];
}
