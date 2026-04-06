'use strict';

require('dotenv').config();
const cron = require('node-cron');
const { triggerCronSync, getFeedType } = require('./lib/sync');

const feedType = getFeedType();

/** Page 1: full source + images + upload cloud (S3) */
async function jobPage1Cloud() {
  const label = `[ikiru-cron] ${new Date().toISOString()} page=1 saveToS3=true type=${feedType}`;
  console.log(label, 'start');
  try {
    const body = await triggerCronSync({
      page: 1,
      mode: 'full',
      withImages: true,
      saveToS3: true,
      type: feedType,
    });
    console.log(label, 'ok', JSON.stringify(body.summary || {}).slice(0, 800));
  } catch (e) {
    console.error(label, 'error', e.message, e.body || '');
  }
}

/** Page 2: full source + images, tanpa insert ke cloud */
async function jobPage2LocalOnly() {
  const label = `[ikiru-cron] ${new Date().toISOString()} page=2 saveToS3=false type=${feedType}`;
  console.log(label, 'start');
  try {
    const body = await triggerCronSync({
      page: 2,
      mode: 'full',
      withImages: true,
      saveToS3: false,
      type: feedType,
    });
    console.log(label, 'ok', JSON.stringify(body.summary || {}).slice(0, 800));
  } catch (e) {
    console.error(label, 'error', e.message, e.body || '');
  }
}

const schedule1 = process.env.CRON_PAGE1_SCHEDULE || '0 * * * *';
const schedule2 = process.env.CRON_PAGE2_SCHEDULE || '30 */3 * * *';
const tz = process.env.CRON_TZ || undefined;

const cronOpts = tz ? { timezone: tz } : {};

cron.schedule(
  schedule1,
  () => {
    jobPage1Cloud().catch((e) => console.error(e));
  },
  cronOpts
);

cron.schedule(
  schedule2,
  () => {
    jobPage2LocalOnly().catch((e) => console.error(e));
  },
  cronOpts
);

console.log(
  'komiknesia-ikiru-cron scheduling:',
  'page1+S3=',
  schedule1,
  '| page2 local images=',
  schedule2,
  tz ? `tz=${tz}` : '',
  '| feed=',
  feedType
);

if (String(process.env.RUN_ON_START).toLowerCase() === 'true') {
  Promise.all([jobPage1Cloud(), jobPage2LocalOnly()]).catch(() => {});
}
