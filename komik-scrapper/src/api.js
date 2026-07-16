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

module.exports = {
  sendToBackend,
};
