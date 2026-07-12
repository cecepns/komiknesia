/* eslint-disable no-undef */
/* eslint-env node */
'use strict';

require('dotenv').config();
const cron = require('node-cron');
const { triggerCronSync, getFeedType } = require('./lib/sync');

const feedType = getFeedType();

async function runIkiruJob({ page, mode, saveToS3 = true }) {
  const label = `[ikiru-cron:ikiru] ${new Date().toISOString()} page=${page} mode=${mode} saveToS3=${saveToS3} type=${feedType}`;
  console.log(label, 'start');
  try {
    const body = await triggerCronSync({
      source: 'ikiru',
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

async function runApkomikJob({ type, page, mode, saveToS3 = true }) {
  const label = `[ikiru-cron:apkomik] ${new Date().toISOString()} type=${type} page=${page} mode=${mode} saveToS3=${saveToS3}`;
  console.log(label, 'start');
  try {
    const body = await triggerCronSync({
      source: 'apkomik',
      page,
      mode,
      withImages: true,
      saveToS3,
      type,
    });
    console.log(label, 'ok', JSON.stringify(body.summary || {}).slice(0, 800));
  } catch (e) {
    console.error(label, 'error', e.message, e.body || '');
  }
}

const schedulePage1Delta = process.env.CRON_PAGE1_DELTA_SCHEDULE || '*/20 * * * *';
const schedulePage1Full = process.env.CRON_PAGE1_FULL_SCHEDULE || '0 * * * *';
const schedulePage2Full = process.env.CRON_PAGE2_FULL_SCHEDULE || '0 */2 * * *';
const tz = process.env.CRON_TZ || undefined;

const cronOpts = tz ? { timezone: tz } : {};

cron.schedule(
  schedulePage1Delta,
  () => {
    runIkiruJob({ page: 1, mode: 'delta' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manga', page: 1, mode: 'delta' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manhua', page: 1, mode: 'delta' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manhwa', page: 1, mode: 'delta' }).catch((e) => console.error(e));
  },
  cronOpts
);

cron.schedule(
  schedulePage1Full,
  () => {
    runIkiruJob({ page: 1, mode: 'full' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manga', page: 1, mode: 'full' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manhua', page: 1, mode: 'full' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manhwa', page: 1, mode: 'full' }).catch((e) => console.error(e));
  },
  cronOpts
);

cron.schedule(
  schedulePage2Full,
  () => {
    runIkiruJob({ page: 2, mode: 'full' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manga', page: 2, mode: 'full' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manhua', page: 2, mode: 'full' }).catch((e) => console.error(e));
    runApkomikJob({ type: 'manhwa', page: 2, mode: 'full' }).catch((e) => console.error(e));
  },
  cronOpts
);

console.log(
  'komiknesia cron scheduling:',
  'page1 delta saveToS3=true',
  schedulePage1Delta,
  '| page1 full saveToS3=true',
  schedulePage1Full,
  '| page2 full saveToS3=true',
  schedulePage2Full,
  tz ? `tz=${tz}` : '',
  '| ikiru-feed=',
  feedType
);

if (String(process.env.RUN_ON_START).toLowerCase() === 'true') {
  Promise.all([
    runIkiruJob({ page: 1, mode: 'delta' }),
    runApkomikJob({ type: 'manga', page: 1, mode: 'delta' }),
    runApkomikJob({ type: 'manhua', page: 1, mode: 'delta' }),
    runApkomikJob({ type: 'manhwa', page: 1, mode: 'delta' }),
  ]).catch(() => {});
}
