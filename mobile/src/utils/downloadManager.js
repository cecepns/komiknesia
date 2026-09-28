import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, getImageUrl } from '../api/client';
import { normalizeChapterImage } from './chapterAccess';

const OFFLINE_INDEX_KEY = '@komiknesia_offline_downloads';

function sanitizeSlug(slug) {
  return String(slug || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export const downloadManager = {
  /**
   * Ambil daftar seluruh komik yang memiliki chapter tersimpan di HP.
   */
  async getAllDownloadedManga() {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_INDEX_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /**
   * Ambil daftar chapter yang sudah diunduh untuk manga tertentu.
   */
  async getDownloadedChapters(mangaSlug) {
    if (!mangaSlug) return [];
    try {
      const all = await this.getAllDownloadedManga();
      const mangaItem = all.find(
        (m) => m.slug === mangaSlug || m.id === mangaSlug
      );
      return Array.isArray(mangaItem?.chapters) ? mangaItem.chapters : [];
    } catch {
      return [];
    }
  },

  /**
   * Cek apakah chapter tertentu sudah tersimpan offline di HP.
   */
  async isChapterDownloaded(mangaSlug, chapterSlug) {
    if (!chapterSlug) return false;
    try {
      const all = await this.getAllDownloadedManga();
      if (mangaSlug) {
        const mangaItem = all.find(
          (m) => m.slug === mangaSlug || m.id === mangaSlug
        );
        if (mangaItem && mangaItem.chapters?.some((c) => c.slug === chapterSlug)) {
          return true;
        }
      }
      return all.some((m) => m.chapters?.some((c) => c.slug === chapterSlug));
    } catch {
      return false;
    }
  },

  /**
   * Ambil data lengkap chapter offline beserta path gambar lokal file://.
   */
  async getDownloadedChapter(mangaSlug, chapterSlug) {
    if (!chapterSlug) return null;
    try {
      const all = await this.getAllDownloadedManga();
      let mangaItem = null;
      let chapter = null;

      if (mangaSlug) {
        mangaItem = all.find(
          (m) => m.slug === mangaSlug || m.id === mangaSlug
        );
        if (mangaItem && Array.isArray(mangaItem.chapters)) {
          chapter = mangaItem.chapters.find((c) => c.slug === chapterSlug);
        }
      }

      // Fallback: jika mangaSlug tidak cocok atau null, cari chapter di seluruh komik terunduh
      if (!chapter) {
        for (const m of all) {
          const ch = m.chapters?.find((c) => c.slug === chapterSlug);
          if (ch) {
            mangaItem = m;
            chapter = ch;
            break;
          }
        }
      }

      if (!mangaItem || !chapter) return null;
      return {
        manga: mangaItem,
        chapter,
      };
    } catch {
      return null;
    }
  },

  /**
   * Unduh chapter ke memori HP sendiri untuk dibaca offline.
   * @param {Object} params
   * @param {Object} params.manga - Info komik { slug, title, cover }
   * @param {Object} params.chapter - Info chapter { slug, number, title }
   * @param {Function} [params.onProgress] - Callback progress (current, total, percent)
   */
  async downloadChapter(arg1, arg2, arg3) {
    let manga, chapter, onProgress;
    if (arg1 && typeof arg1 === 'object' && (arg1.manga || arg1.chapter)) {
      manga = arg1.manga;
      chapter = arg1.chapter;
      onProgress = arg1.onProgress;
    } else {
      manga = arg1;
      chapter = arg2;
      onProgress = arg3;
    }

    if (!manga?.slug || !chapter?.slug) {
      throw new Error('Data komik atau chapter tidak lengkap.');
    }

    const safeMangaSlug = sanitizeSlug(manga.slug);
    const safeChapterSlug = sanitizeSlug(chapter.slug);

    // Root folder penyimpanan di HP pengguna
    const baseDir = FileSystem?.documentDirectory || FileSystem?.cacheDirectory || '';
    const mangaDir = `${baseDir}downloads/${safeMangaSlug}/`;
    const chapterDir = `${mangaDir}${safeChapterSlug}/`;

    // Pastikan folder direktori dibuat
    if (typeof FileSystem?.makeDirectoryAsync === 'function') {
      try {
        await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });
      } catch (e) {
        console.warn('makeDirectoryAsync warning:', e);
      }
    }

    // 1. Dapatkan daftar gambar chapter dari API
    let rawImages = chapter.images || [];
    if (!rawImages || rawImages.length === 0) {
      const detailRes = await apiClient.getChapterDetail(chapter.slug);
      if (detailRes?.status && detailRes.data?.images) {
        rawImages = detailRes.data.images;
      }
    }

    const normalizedImages = (rawImages || [])
      .map(normalizeChapterImage)
      .filter((img) => !!img?.src);

    if (normalizedImages.length === 0) {
      throw new Error('Chapter ini tidak memiliki gambar untuk diunduh.');
    }

    // 2. Simpan cover komik lokal jika belum ada
    let localCoverUri = null;
    const coverUrl = manga.cover || manga.image || manga.thumbnail;
    if (coverUrl && typeof FileSystem?.downloadAsync === 'function') {
      try {
        const coverTarget = `${mangaDir}cover.jpg`;
        const coverInfo = typeof FileSystem?.getInfoAsync === 'function' ? await FileSystem.getInfoAsync(coverTarget) : null;
        if (!coverInfo?.exists) {
          const downloadRes = await FileSystem.downloadAsync(
            getImageUrl(coverUrl),
            coverTarget
          );
          localCoverUri = downloadRes?.uri || coverTarget;
        } else {
          localCoverUri = coverTarget;
        }
      } catch {
        // Fallback to remote cover if fails
        localCoverUri = getImageUrl(coverUrl);
      }
    }

    // 3. Unduh setiap halaman gambar ke penyimpanan internal HP
    const localImages = [];
    let totalBytes = 0;
    const totalCount = normalizedImages.length;

    for (let i = 0; i < totalCount; i++) {
      const item = normalizedImages[i];
      const remoteSrc = getImageUrl(item.src);
      const ext = remoteSrc.includes('.png') ? 'png' : remoteSrc.includes('.webp') ? 'webp' : 'jpg';
      const fileTarget = `${chapterDir}page_${String(i + 1).padStart(3, '0')}.${ext}`;

      try {
        if (typeof FileSystem?.downloadAsync === 'function') {
          const result = await FileSystem.downloadAsync(remoteSrc, fileTarget);
          localImages.push({
            src: result?.uri || fileTarget, // file:// path on device storage!
            page: i + 1,
          });

          // Track file size
          if (typeof FileSystem?.getInfoAsync === 'function') {
            const info = await FileSystem.getInfoAsync(result?.uri || fileTarget);
            if (info?.size) totalBytes += info.size;
          }
        } else {
          localImages.push({
            src: remoteSrc,
            page: i + 1,
          });
        }
      } catch (err) {
        console.warn(`Gagal mengunduh halaman ${i + 1}:`, err);
        // If image download fails, record original src as fallback
        localImages.push({
          src: remoteSrc,
          page: i + 1,
        });
      }

      if (onProgress) {
        onProgress(i + 1, totalCount, Math.round(((i + 1) / totalCount) * 100));
      }
    }

    // 4. Perbarui indeks database lokal di AsyncStorage
    const all = await this.getAllDownloadedManga();
    let mangaEntry = all.find((m) => m.slug === manga.slug);

    const chapterRecord = {
      slug: chapter.slug,
      number: chapter.number || chapter.chapter_number || '?',
      title: chapter.title || null,
      downloadedAt: new Date().toISOString(),
      images: localImages,
      totalImages: localImages.length,
      sizeBytes: totalBytes,
      localDir: chapterDir,
    };

    if (!mangaEntry) {
      mangaEntry = {
        slug: manga.slug,
        title: manga.title || 'Komik',
        cover: localCoverUri || getImageUrl(coverUrl),
        chapters: [chapterRecord],
      };
      all.push(mangaEntry);
    } else {
      // Gantikan atau tambahkan chapter
      const existingChIdx = mangaEntry.chapters.findIndex(
        (c) => c.slug === chapter.slug
      );
      if (existingChIdx >= 0) {
        mangaEntry.chapters[existingChIdx] = chapterRecord;
      } else {
        mangaEntry.chapters.push(chapterRecord);
      }
      // Sort chapters by number descending
      mangaEntry.chapters.sort((a, b) => Number(b.number || 0) - Number(a.number || 0));
    }

    await AsyncStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(all));
    return chapterRecord;
  },

  /**
   * Hapus chapter yang telah diunduh dari penyimpanan HP.
   */
  async deleteDownloadedChapter(mangaSlug, chapterSlug) {
    try {
      const all = await this.getAllDownloadedManga();
      const mangaEntry = all.find((m) => m.slug === mangaSlug);
      if (!mangaEntry) return;

      const safeMangaSlug = sanitizeSlug(mangaSlug);
      const safeChapterSlug = sanitizeSlug(chapterSlug);
      const chapterDir = `${FileSystem.documentDirectory}downloads/${safeMangaSlug}/${safeChapterSlug}/`;

      // Hapus berkas fisik dari storage HP
      try {
        await FileSystem.deleteAsync(chapterDir, { idempotent: true });
      } catch (err) {
        console.warn('Gagal menghapus folder chapter:', err);
      }

      // Hapus dari data AsyncStorage
      mangaEntry.chapters = mangaEntry.chapters.filter((c) => c.slug !== chapterSlug);

      let updatedAll;
      if (mangaEntry.chapters.length === 0) {
        // Hapus juga folder manga jika sudah kosong
        const mangaDir = `${FileSystem.documentDirectory}downloads/${safeMangaSlug}/`;
        try {
          await FileSystem.deleteAsync(mangaDir, { idempotent: true });
        } catch {}
        updatedAll = all.filter((m) => m.slug !== mangaSlug);
      } else {
        updatedAll = all;
      }

      await AsyncStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(updatedAll));
    } catch (err) {
      console.warn('Error deleting chapter:', err);
    }
  },

  /**
   * Hapus seluruh data dan chapter terunduh dari suatu komik.
   */
  async deleteDownloadedManga(mangaSlug) {
    try {
      const all = await this.getAllDownloadedManga();
      const mangaEntry = all.find((m) => m.slug === mangaSlug);
      if (!mangaEntry) return;

      const safeMangaSlug = sanitizeSlug(mangaSlug);
      const mangaDir = `${FileSystem.documentDirectory}downloads/${safeMangaSlug}/`;
      try {
        await FileSystem.deleteAsync(mangaDir, { idempotent: true });
      } catch (err) {
        console.warn('Gagal menghapus folder manga:', err);
      }

      const updatedAll = all.filter((m) => m.slug !== mangaSlug);
      await AsyncStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(updatedAll));
    } catch (err) {
      console.warn('Error deleting manga:', err);
    }
  },

  /**
   * Bersihkan semua unduhan offline.
   */
  async deleteAllDownloads() {
    try {
      const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
      await FileSystem.deleteAsync(downloadsDir, { idempotent: true });
      await AsyncStorage.removeItem(OFFLINE_INDEX_KEY);
    } catch (err) {
      console.warn('Error clearing downloads:', err);
    }
  },

  /**
   * Hitung total kapasitas storage yang digunakan unduhan (format MB / GB).
   */
  async getTotalStorageInfo() {
    try {
      const all = await this.getAllDownloadedManga();
      let totalBytes = 0;
      let totalChapters = 0;

      for (const m of all) {
        for (const c of m.chapters || []) {
          totalBytes += c.sizeBytes || 0;
          totalChapters += 1;
        }
      }

      let totalMb = '';
      if (totalBytes >= 1024 * 1024 * 1024) {
        totalMb = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      } else {
        totalMb = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
      }

      return {
        totalBytes,
        totalMb,
        totalManga: all.length,
        totalChapters,
      };
    } catch {
      return { totalBytes: 0, totalMb: '0 MB', totalManga: 0, totalChapters: 0 };
    }
  },
};
