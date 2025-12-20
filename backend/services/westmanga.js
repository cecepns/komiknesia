import axios from 'axios';

const WESTMANGA_BASE_URL = 'https://data.westmanga.me/api';

/**
 * WestManga API Service
 * Handles all interactions with WestManga API
 */
class WestMangaService {
  constructor() {
    this.baseURL = WESTMANGA_BASE_URL;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  /**
   * Get list of manga from WestManga
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.per_page - Items per page (default: 25)
   * @param {string} params.search - Search query
   * @param {string} params.genre - Genre filter
   * @param {string} params.status - Status filter (ongoing, completed)
   * @param {string} params.type - Content type (comic, manga, manhwa, manhua)
   * @param {string} params.sort - Sort by (latest, popular, rating)
   * @returns {Promise} API response
   */
  async getMangaList(params = {}) {
    try {
      const response = await this.axiosInstance.get('/contents', {
        params: {
          page: params.page || 1,
          per_page: params.per_page || 25,
          ...params
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching manga list from WestManga:', error.message);
      throw error;
    }
  }

  /**
   * Get manga detail by slug
   * @param {string} slug - Manga slug
   * @returns {Promise} API response
   */
  async getMangaDetail(slug) {
    try {
      const response = await this.axiosInstance.get(`/contents/${slug}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching manga detail for ${slug}:`, error.message);
      throw error;
    }
  }

  /**
   * Get chapter detail by slug
   * @param {string} chapterSlug - Chapter slug
   * @returns {Promise} API response
   */
  async getChapterDetail(chapterSlug) {
    try {
      const response = await this.axiosInstance.get(`/chapters/${chapterSlug}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching chapter detail for ${chapterSlug}:`, error.message);
      throw error;
    }
  }

  /**
   * Search manga by title
   * @param {string} query - Search query
   * @param {number} page - Page number
   * @returns {Promise} API response
   */
  async searchManga(query, page = 1) {
    return this.getMangaList({ search: query, page });
  }

  /**
   * Get popular manga
   * @param {number} page - Page number
   * @returns {Promise} API response
   */
  async getPopularManga(page = 1) {
    return this.getMangaList({ sort: 'popular', page });
  }

  /**
   * Get latest updated manga
   * @param {number} page - Page number
   * @returns {Promise} API response
   */
  async getLatestManga(page = 1) {
    return this.getMangaList({ sort: 'latest', page });
  }

  /**
   * Transform WestManga API data to our database format
   * @param {Object} mangaData - Manga data from WestManga API
   * @returns {Object} Transformed manga object
   */
  transformMangaData(mangaData) {
    return {
      westmanga_id: mangaData.id,
      title: mangaData.title,
      slug: mangaData.slug,
      alternative_name: mangaData.alternative_name || null,
      author: mangaData.author || 'Unknown',
      synopsis: mangaData.sinopsis || mangaData.synopsis || null,
      thumbnail: mangaData.cover || null,
      content_type: mangaData.content_type || 'comic',
      country_id: mangaData.country_id || null,
      color: mangaData.color !== undefined ? mangaData.color : true,
      hot: mangaData.hot || false,
      is_project: mangaData.is_project || false,
      is_safe: mangaData.is_safe !== undefined ? mangaData.is_safe : true,
      rating: mangaData.rating || 0,
      bookmark_count: mangaData.bookmark_count || 0,
      views: mangaData.total_views || 0,
      release: mangaData.release || null,
      status: mangaData.status || 'ongoing',
      is_input_manual: false // Data from WestManga
    };
  }

  /**
   * Transform chapter data from WestManga API
   * @param {Object} chapterData - Chapter data from WestManga API
   * @returns {Object} Transformed chapter object
   */
  transformChapterData(chapterData) {
    return {
      westmanga_chapter_id: chapterData.id,
      title: chapterData.title || `Chapter ${chapterData.number}`,
      slug: chapterData.slug,
      chapter_number: chapterData.number,
      created_at: chapterData.created_at?.time 
        ? new Date(chapterData.created_at.time * 1000) 
        : new Date()
    };
  }
}

// Export singleton instance
const westMangaService = new WestMangaService();
export default westMangaService;




