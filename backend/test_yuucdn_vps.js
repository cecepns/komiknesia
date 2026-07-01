const axios = require('axios');
const { getIkiruCdnFetchHeaders } = require('./utils/ikiruCdnImage');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testAxios() {
  const url = 'https://yuucdn.com/wp-content/uploads/imgsc/m/mairimashita-iruma-kun/448/1.jpg';
  
  console.log('\n--- Testing Axios Fetch through Webshare Proxy ---');
  try {
    const headers = getIkiruCdnFetchHeaders('https://v6.kiryuu.to/', url);
    console.log('Sending headers:', JSON.stringify(headers, null, 2));
    
    const proxyAgent = new HttpsProxyAgent('http://jlqhqvqf-rotate:2q5jwr526cph@p.webshare.io:80');
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 0,
      validateStatus: (s) => s < 400 || (s >= 300 && s < 400),
      headers: headers,
      httpsAgent: proxyAgent
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
  } catch (err) {
    console.error('Axios Error:', err.message);
    if (err.response) {
      console.log('Error Status:', err.response.status);
      console.log('Error Headers:', JSON.stringify(err.response.headers, null, 2));
    }
  }
}

testAxios();
