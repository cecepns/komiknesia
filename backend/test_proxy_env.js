require('dotenv').config();
const axios = require('axios');
const { getIkiruCdnFetchHeaders } = require('./utils/ikiruCdnImage');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testAxios() {
  const url = 'https://yuucdn.com/wp-content/uploads/imgsc/m/mairimashita-iruma-kun/448/1.jpg';
  
  console.log('\n--- Testing Axios Fetch through ENV Proxy ---');
  
  const proxyUrl = process.env.OUTBOUND_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
  console.log('Detected OUTBOUND_PROXY:', proxyUrl || '(EMPTY)');
  
  if (!proxyUrl) {
    console.error('ERROR: No proxy URL found in environment variables (check your .env file).');
    return;
  }
  
  try {
    const headers = getIkiruCdnFetchHeaders('https://v6.kiryuu.to/', url);
    
    const proxyAgent = new HttpsProxyAgent(proxyUrl);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 0,
      validateStatus: (s) => s < 400 || (s >= 300 && s < 400),
      headers: headers,
      httpsAgent: proxyAgent
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Headers (first 5 keys):', Object.keys(response.headers).slice(0, 5));
    if (response.status === 200) {
      console.log('SUCCESS! Fetch through proxy succeeded.');
    } else {
      console.log('FAILED! Redirected to:', response.headers.location);
    }
  } catch (err) {
    console.error('Axios Error:', err.message);
    if (err.response) {
      console.log('Error Status:', err.response.status);
    }
  }
}

testAxios();
