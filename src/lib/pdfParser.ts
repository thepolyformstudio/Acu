// Client-side PDF page-by-page text extractor using pdfjs-dist CDN worker
export async function extractTextPageByPage(
  file: File | Blob
): Promise<{ pageNumber: number; text: string }[]> {
  // Dynamically import pdfjs-dist client-side to prevent SSR ReferenceErrors (DOMMatrix) during compile
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configure worker using the local self-hosted public file to prevent network CDN issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  
  // Load the document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pagesData: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items on the page, adding newlines when Y coordinate changes significantly
      let pageText = '';
      let lastY = null;
      for (const item of textContent.items as any[]) {
        if (!item.str) continue;
        const currentY = item.transform[5];
        if (lastY !== null && Math.abs(currentY - lastY) > 4) {
          pageText += '\n';
        } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = currentY;
      }
      
      pagesData.push({
        pageNumber: i,
        text: pageText.trim()
      });
    } catch (err) {
      console.error(`Error parsing page ${i}:`, err);
      pagesData.push({
        pageNumber: i,
        text: ''
      });
    }
  }

  return pagesData;
}
