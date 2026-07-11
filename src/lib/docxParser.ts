import mammoth from 'mammoth';

export async function extractWordText(
  file: File | Blob
): Promise<{ pageNumber: number; text: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const rawText = result.value || '';
  
  if (!rawText.trim()) {
    return [];
  }

  // Because word documents don't have hardcoded physical page segments,
  // we split the text at double newlines or every 1800 characters to simulate pages.
  const paragraphs = rawText.split('\n\n').filter(p => p.trim().length > 0);
  const simulatedPages: { pageNumber: number; text: string }[] = [];
  
  let currentPageText = "";
  let pageNum = 1;

  for (const para of paragraphs) {
    if (currentPageText.length + para.length > 1800) {
      simulatedPages.push({
        pageNumber: pageNum,
        text: currentPageText.trim()
      });
      currentPageText = para;
      pageNum++;
    } else {
      currentPageText += "\n\n" + para;
    }
  }

  if (currentPageText.trim()) {
    simulatedPages.push({
      pageNumber: pageNum,
      text: currentPageText.trim()
    });
  }

  return simulatedPages;
}
