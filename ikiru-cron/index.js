'use strict';

require('dotenv').config();
const cron = require('node-cron');
const { triggerCronSync, getFeedType } = require('./lib/sync');

const feedType = getFeedType();

async function runJob({ page, mode, saveToS3 }) {
  const label = `[ikiru-cron] ${new Date().toISOString()} page=${page} mode=${mode} saveToS3=${saveToS3} type=${feedType}`;
  console.log(label, 'start');
  try {
    const body = await triggerCronSync({
      page,
      mode,
      withImages: true,
      saveToS3,
      type: feedType,
    });
    console.log(label, 'ok', JSON.stringify(body.summary || {}).slice(0, 800));
  } catch (e) {
    console.error(label, 'error', e.message, e.body || '');
  }
}

const schedulePage1Delta = process.env.CRON_PAGE1_DELTA_SCHEDULE || '*/10 * * * *';
const schedulePage1Full = process.env.CRON_PAGE1_FULL_SCHEDULE || '0 * * * *';
const schedulePage2Full = process.env.CRON_PAGE2_FULL_SCHEDULE || '0 */2 * * *';
const schedulePage3Full = process.env.CRON_PAGE3_FULL_SCHEDULE || '0 */3 * * *';
const tz = process.env.CRON_TZ || undefined;

const cronOpts = tz ? { timezone: tz } : {};

cron.schedule(
  schedulePage1Delta,
  () => {
    runJob({ page: 1, mode: 'delta', saveToS3: false }).catch((e) => console.error(e));
  },
  cronOpts
);

cron.schedule(
  schedulePage1Full,
  () => {
    runJob({ page: 1, mode: 'full', saveToS3: true }).catch((e) => console.error(e));
  },
  cronOpts
);

cron.schedule(
  schedulePage2Full,
  () => {
    runJob({ page: 2, mode: 'full', saveToS3: false }).catch((e) => console.error(e));
  },
  cronOpts
);

cron.schedule(
  schedulePage3Full,
  () => {
    runJob({ page: 3, mode: 'full', saveToS3: false }).catch((e) => console.error(e));
  },
  cronOpts
);

console.log(
  'komiknesia-ikiru-cron scheduling:',
  'page1 delta local=',
  schedulePage1Delta,
  '| page1 full + s3=',
  schedulePage1Full,
  '| page2 full local=',
  schedulePage2Full,
  '| page3 full local=',
  schedulePage3Full,
  tz ? `tz=${tz}` : '',
  '| feed=',
  feedType
);

if (String(process.env.RUN_ON_START).toLowerCase() === 'true') {
  Promise.all([
    runJob({ page: 1, mode: 'delta', saveToS3: false }),
    runJob({ page: 1, mode: 'full', saveToS3: true }),
    runJob({ page: 2, mode: 'full', saveToS3: false }),
    runJob({ page: 3, mode: 'full', saveToS3: false }),
  ]).catch(() => {});
}
