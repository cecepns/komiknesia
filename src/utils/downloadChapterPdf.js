import { API_BASE_URL, apiClient, getImageUrl } from './api';

/**
 * Downloads a full chapter as a PDF file containing all page images.
 * @param {Object} options
 * @param {string} options.slug - Chapter slug
 * @param {string} [options.mangaTitle] - Manga title
 * @param {string|number} [options.chapterNumber] - Chapter number
 */
export async function downloadChapterPdf({ slug, mangaTitle = 'Komik', chapterNumber = '' }) {
  if (!slug) throw new Error('Slug chapter tidak valid');

  // 1. Fetch chapter detail using correct endpoint /chapters/slug/:slug
  const token = apiClient.getAuthToken();
  const res = await fetch(`${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = 'Gagal mengambil data chapter dari server';
    try {
      const errData = await res.json();
      if (errData?.error || errData?.message) {
        message = errData.error || errData.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const json = await res.json();
  const data = json.data || {};
  const images = data.images || data.pages || data.content?.images || [];

  if (!images || images.length === 0) {
    throw new Error('Tidak ada gambar di chapter ini');
  }

  // 2. Load jsPDF dynamically
  const { jsPDF } = await import('jspdf');

  // 3. Helper to load image as Data URL via canvas
  const loadImageDataUrl = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ dataUrl, width: canvas.width, height: canvas.height });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error(`Gagal memuat gambar: ${url}`));
      img.src = getImageUrl(url);
    });
  };

  // 4. Load all images
  const loadedPages = [];
  for (const imgPath of images) {
    try {
      const loaded = await loadImageDataUrl(imgPath);
      loadedPages.push(loaded);
    } catch (err) {
      console.warn('Skipping failed image load:', err);
    }
  }

  if (loadedPages.length === 0) {
    throw new Error('Gagal memuat gambar chapter');
  }

  // 5. Generate PDF
  const first = loadedPages[0];
  const pdf = new jsPDF({
    orientation: first.width > first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height],
  });

  loadedPages.forEach((page, index) => {
    if (index > 0) {
      pdf.addPage([page.width, page.height], page.width > page.height ? 'landscape' : 'portrait');
    }
    pdf.addImage(page.dataUrl, 'JPEG', 0, 0, page.width, page.height);
  });

  // 6. Save PDF
  const cleanTitle = (mangaTitle || 'Komik').replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
  const filename = `${cleanTitle}_Chapter_${chapterNumber || '1'}.pdf`;
  pdf.save(filename);
}
