import { API_BASE_URL, apiClient, getImageUrl } from './api';

/**
 * Downloads a full chapter as a PDF file.
 * Priority 1: Backend PDF stream endpoint (if deployed on BE).
 * Priority 2: Client-side jsPDF with weserv.nl CORS proxy image loader.
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

  // 1. Try Backend PDF Endpoint (Check if content-type is actual PDF, not HTML 404)
  const pdfEndpoint = `${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}/download-pdf`;
  try {
    const res = await fetch(pdfEndpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && (contentType.includes('application/pdf') || contentType.includes('octet-stream'))) {
      const blob = await res.blob();
      triggerFileDownload(blob, pdfFilename);
      return;
    }
  } catch (err) {
    console.warn('Backend PDF endpoint unavailable:', err);
  }

  // 2. Try Backend ZIP Endpoint (Check if content-type is zip)
  const zipEndpoint = `${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}/download`;
  try {
    const res = await fetch(zipEndpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && (contentType.includes('application/zip') || contentType.includes('octet-stream'))) {
      const blob = await res.blob();
      const zipFilename = `${cleanTitle}_Chapter_${chapterNumber || '1'}.zip`;
      triggerFileDownload(blob, zipFilename);
      return;
    }
  } catch (err) {
    console.warn('Backend ZIP download unavailable:', err);
  }

  // 3. Fallback: Generate PDF on Client-side via jsPDF + weserv.nl CORS Image Proxy
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

  // Load single image via weserv.nl CORS proxy & convert to JPEG Data URL
  const loadImageDataUrl = (url) => {
    return new Promise((resolve, reject) => {
      const fullUrl = getImageUrl(url);
      if (!fullUrl) return reject(new Error('URL gambar tidak valid'));

      // Proxy candidates (weserv.nl adds Access-Control-Allow-Origin: * to CDN images)
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(fullUrl)}`;
      const backupProxyUrl = `https://proxy.cdnesia.my.id/?url=${encodeURIComponent(fullUrl)}`;

      const tryLoadImage = (src, isFallback = false) => {
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
            if (!isFallback) tryLoadImage(backupProxyUrl, true);
            else reject(e);
          }
        };
        img.onerror = () => {
          if (!isFallback) tryLoadImage(backupProxyUrl, true);
          else reject(new Error(`Gagal memuat gambar chapter`));
        };
        img.src = src;
      };

      tryLoadImage(proxyUrl);
    });
  };

  const loadedPages = [];
  for (const imgPath of images) {
    try {
      const loaded = await loadImageDataUrl(imgPath);
      if (loaded && loaded.dataUrl) {
        loadedPages.push(loaded);
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
