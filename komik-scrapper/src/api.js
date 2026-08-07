require('dotenv').config();
const axios = require('axios');

async function sendToBackend(payload) {
  const url = process.env.KOMIKNESIA_API_URL;
  const secret = process.env.KOMIKNESIA_API_SECRET;

  if (!url) {
    throw new Error('KOMIKNESIA_API_URL is not set in .env');
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      timeout: 60000, // 60s
    });

    return response.data;
  } catch (error) {
    const msg = error.response ? JSON.stringify(error.response.data) : error.message;
    throw new Error(`Failed to send data to backend: ${msg}`);
  }
}

async function checkChapterExists(localSlug) {
  const url = process.env.KOMIKNESIA_API_URL;
  if (!url) return false;

  try {
    const apiBase = url.replace(/\/api\/(admin\/)?scrapper-sync\/sync.*$/, '');
    const checkUrl = `${apiBase}/api/chapters/slug/${encodeURIComponent(localSlug)}`;

    const response = await axios.get(checkUrl, { timeout: 8000 });
    if (response.status === 200 && response.data && response.data.status === true) {
      return true;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false;
    }
    console.warn(`[checkChapterExists] Gagal mengecek chapter ${localSlug}:`, error.message);
  }
  return false;
}

module.exports = {
  sendToBackend,
  checkChapterExists,
};

