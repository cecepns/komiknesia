import { API_BASE_URL, apiClient, getImageUrl } from './api';

/**
 * Downloads a full chapter as a PDF file containing all page images.
 * Uses CORS proxy cascade and FileReader blob conversion to bypass CDN CORS blocking.
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

  // Priority 1: Backend PDF stream endpoint if available
  const pdfEndpoint = `${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}/download-pdf`;
  try {
    const res = await fetch(pdfEndpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const blob = await res.blob();
      triggerFileDownload(blob, pdfFilename);
      return;
    }
  } catch (err) {
    console.warn('Backend PDF stream unavailable:', err);
  }

  // Priority 2: Client-side jsPDF with Proxy Blob Loader Cascade
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

  // Load image blob via proxy cascade & convert to base64 Data URL
  const loadImageDataUrl = (url) => {
    return new Promise((resolve, reject) => {
      const fullUrl = getImageUrl(url);

      const tryFetchBlob = async (targetUrl) => {
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        return new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
              res({
                dataUrl: reader.result,
                width: img.naturalWidth || img.width || 800,
                height: img.naturalHeight || img.height || 1200,
              });
            };
            img.onerror = () => rej(new Error('Image decode error'));
            img.src = reader.result;
          };
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
      };

      // Cascade strategy: Proxy 1 -> Proxy 2 -> Direct fetch -> Canvas fallback
      const proxy1 = `https://proxy.cdnesia.my.id/?url=${encodeURIComponent(fullUrl)}`;
      const proxy2 = `${API_BASE_URL}/image-proxy?url=${encodeURIComponent(fullUrl)}`;

      tryFetchBlob(proxy1)
        .then(resolve)
        .catch(() => {
          tryFetchBlob(proxy2)
            .then(resolve)
            .catch(() => {
              tryFetchBlob(fullUrl)
                .then(resolve)
                .catch(() => {
                  // Fallback HTML Image & Canvas
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
                      resolve({ dataUrl, width: canvas.width, height: canvas.height });
                    } catch (e) {
                      reject(e);
                    }
                  };
                  img.onerror = () => reject(new Error('Gagal memuat gambar'));
                  img.src = fullUrl;
                });
            });
        });
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
    throw new Error('Gagal memuat gambar chapter untuk membuat PDF. Silakan coba beberapa saat lagi.');
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
