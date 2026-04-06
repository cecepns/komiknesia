'use strict';

require('dotenv').config();
const { triggerCronSync, getFeedType } = require('./lib/sync');

const feedType = getFeedType();
const which = process.argv[2];

async function main() {
  if (which === 'page1') {
    const body = await triggerCronSync({
      page: 1,
      mode: 'full',
      withImages: true,
      saveToS3: true,
      type: feedType,
    });
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  if (which === 'page2') {
    const body = await triggerCronSync({
      page: 2,
      mode: 'full',
      withImages: true,
      saveToS3: false,
      type: feedType,
    });
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  console.error('Usage: node run-once.js page1|page2');
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message, e.body || '');
  process.exit(1);
});
