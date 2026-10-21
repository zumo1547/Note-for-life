import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

export async function extractPdfText(file, onProgress = () => {}) {
  if (file.size > 25 * 1024 * 1024) throw new Error('PDF ใหญ่เกิน 25 MB');
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 250) throw new Error('PDF มีมากกว่า 250 หน้า');
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = '';
      let previous = null;
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        const x = item.transform?.[4];
        const gap = previous && Number.isFinite(x) ? x - (previous.x + previous.width) : 0;
        if (text && !text.endsWith('\n') && gap > 3 && !/^\s/.test(item.str)) text += ' ';
        text += item.str;
        if (item.hasEOL) text += '\n';
        previous = { x: Number.isFinite(x) ? x : 0, width: item.width || 0 };
      }
      pages.push(`--- หน้า ${pageNumber} ---\n${text.trim()}`);
      onProgress(pageNumber, pdf.numPages);
      page.cleanup();
    }
    const combined = pages.join('\n\n').trim();
    if (!combined.replace(/--- หน้า \d+ ---/g, '').trim()) throw new Error('PDF นี้ไม่มีข้อความให้ดึง อาจเป็นไฟล์สแกนภาพ');
    return { text: combined, pages: pdf.numPages };
  } finally { await task.destroy(); }
}
