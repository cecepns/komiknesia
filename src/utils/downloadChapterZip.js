import { API_BASE_URL, apiClient } from './api';

const sanitizeFilename = (name) =>
  String(name || 'chapter')
    .replace(/[^\w\s.-]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);

/**
 * Unduh semua gambar chapter sebagai file ZIP via backend.
 * @param {{ slug: string, mangaTitle?: string, chapterNumber?: string|number }} params
 */
export async function downloadChapterZip({ slug, mangaTitle, chapterNumber }) {
  if (!slug) {
    throw new Error('Slug chapter tidak valid');
  }

  const token = apiClient.getAuthToken();
  const url = `${API_BASE_URL}/chapters/slug/${encodeURIComponent(slug)}/download`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = 'Gagal mengunduh chapter';
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const safeManga = sanitizeFilename(mangaTitle || 'manga');
  const safeChapter = sanitizeFilename(chapterNumber ?? '0');
  const filename = `${safeManga}_chapter-${safeChapter}.zip`;

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
