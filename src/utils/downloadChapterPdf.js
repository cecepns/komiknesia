import { API_BASE_URL, apiClient, getImageUrl } from './api';

/**
 * Downloads a full chapter strictly as a PDF file.
 * Priority 1: Backend PDF stream endpoint (if available on BE).
 * Priority 2: Client-side jsPDF with CORS proxy image candidate cascade.
 * @param {Object} options
 * @param {string} options.slug - Chapter slug
 * @param {string} [options.mangaTitle] - Manga title
 * @param {string|number} [options.chapterNumber] - Chapter number
 */
export async function downloadChapterPdf({ slug, mangaTitle = 'Komik', chapterNumber = '' }) {
  if (!slug) throw new Error('Slug chapter tidak valid');

  const token = apiClient.getAuthToken();
  const cleanTitle = (mangaTitle || 'Komik').replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
  const pdfFilename = `${cleanTitle}_Chapter_${chapterNumber || '1'}.pdf`;

  // 1. Try Backend PDF Endpoint (Must be actual PDF content-type)
  const pdfEndpoint = `${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}/download-pdf`;
  try {
    const res = await fetch(pdfEndpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && (contentType.includes('application/pdf') || contentType.includes('pdf'))) {
      const blob = await res.blob();
      triggerFileDownload(blob, pdfFilename);
      return;
    }
  } catch (err) {
    console.warn('Backend PDF endpoint error:', err);
  }

  // 2. Try Backend PDF Format Query Endpoint
  const pdfFormatEndpoint = `${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}/download?format=pdf`;
  try {
    const res = await fetch(pdfFormatEndpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && (contentType.includes('application/pdf') || contentType.includes('pdf'))) {
      const blob = await res.blob();
      triggerFileDownload(blob, pdfFilename);
      return;
    }
  } catch (err) {
    console.warn('Backend PDF format query error:', err);
  }

  // 3. Fallback: Always generate a PDF file on Client-side via jsPDF
  await downloadClientJsPdf({ slug, mangaTitle, chapterNumber, token });
}

function triggerFileDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadClientJsPdf({ slug, mangaTitle, chapterNumber, token }) {
  // Fetch chapter details from API to get array of page image URLs
  const res = await fetch(`${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error('Gagal mengambil data chapter dari server');

  const json = await res.json();
  const data = json.data || {};
  const images = data.images || data.pages || data.content?.images || [];

  if (!images || images.length === 0) {
    throw new Error('Tidak ada gambar di chapter ini');
  }

  const { jsPDF } = await import('jspdf');

  // Load image via candidate cascade to convert to JPEG Data URL
  const loadImageDataUrl = (url) => {
    return new Promise((resolve, reject) => {
      const fullUrl = getImageUrl(url);
      if (!fullUrl) return reject(new Error('URL gambar tidak valid'));

      const candidates = [
        `https://images.weserv.nl/?url=${encodeURIComponent(fullUrl)}`,
        `https://proxy.cdnesia.my.id/?url=${encodeURIComponent(fullUrl)}`,
        `${API_BASE_URL}/image-proxy?url=${encodeURIComponent(fullUrl)}`,
        fullUrl,
      ];

      const tryNextCandidate = (index) => {
        if (index >= candidates.length) {
          return reject(new Error('Gagal memuat gambar'));
        }

        const src = candidates[index];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 800;
            canvas.height = img.naturalHeight || img.height || 1200;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({
              dataUrl,
              width: canvas.width,
              height: canvas.height,
            });
          } catch (e) {
            tryNextCandidate(index + 1);
          }
        };
        img.onerror = () => {
          tryNextCandidate(index + 1);
        };
        img.src = src;
      };

      tryNextCandidate(0);
    });
  };

  // Standardize target PDF width (800px) so all pages have uniform page width
  const TARGET_WIDTH = 800;

  const loadedPages = [];
  for (const imgPath of images) {
    try {
      const loaded = await loadImageDataUrl(imgPath);
      if (loaded && loaded.dataUrl) {
        // Calculate scaled dimensions to normalize width to TARGET_WIDTH
        const scale = TARGET_WIDTH / loaded.width;
        const normWidth = TARGET_WIDTH;
        const normHeight = Math.round(loaded.height * scale);
        loadedPages.push({
          dataUrl: loaded.dataUrl,
          width: normWidth,
          height: normHeight,
        });
      }
    } catch (err) {
      console.warn('Skipping failed page image:', err);
    }
  }

  if (loadedPages.length === 0) {
    throw new Error('Gagal memuat gambar chapter untuk membuat PDF. Silakan coba lagi.');
  }

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

  const cleanTitle = (mangaTitle || 'Komik').replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
  const filename = `${cleanTitle}_Chapter_${chapterNumber || '1'}.pdf`;
  pdf.save(filename);
}
