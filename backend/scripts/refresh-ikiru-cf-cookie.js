'use strict';
/* eslint-disable no-undef */
/* eslint-env node */

require('dotenv').config();
const { refreshIkiruCloudflareCookieWithPuppeteer } = require('../utils/ikiruSession');

const targetUrl = String(process.env.IKIRU_CF_TARGET_URL || 'https://03.ikiru.wtf/latest-update/').trim();
const maxWaitMs = Number(process.env.IKIRU_CF_MAX_WAIT_MS || 180000);
const headless = String(process.env.IKIRU_CF_HEADLESS || 'true').toLowerCase() !== 'false';
const debugScreenshot = String(process.env.IKIRU_CF_DEBUG_SCREENSHOT || '').trim();
const clearOnFail = String(process.env.IKIRU_CF_CLEAR_ON_FAIL || 'false').toLowerCase() === 'true';

async function main() {
  console.log('[ikiru-cf] target =', targetUrl);
  console.log('[ikiru-cf] headless =', headless);
  console.log('[ikiru-cf] max wait ms =', maxWaitMs);
  const result = await refreshIkiruCloudflareCookieWithPuppeteer({
    targetUrl,
    maxWaitMs,
    headless,
    debugScreenshot,
    clearOnFail,
  });
  console.log('[ikiru-cf] cookie refreshed ->', result.cookieFile);
  console.log('[ikiru-cf] cookie length =', result.cookieLength);
}

main().catch((e) => {
  console.error('[ikiru-cf] failed:', e.message);
  process.exit(1);
});
