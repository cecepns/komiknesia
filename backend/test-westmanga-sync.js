#!/usr/bin/env node

/**
 * Test script for WestManga sync functionality
 * Usage: node test-westmanga-sync.js [page] [limit]
 * Example: node test-westmanga-sync.js 1 10
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testWestMangaSync(page = 1, limit = 10) {
  log('\n=== WestManga Sync Test ===\n', 'bright');
  
  try {
    // Step 1: Check if backend is running
    log('1. Checking backend status...', 'cyan');
    try {
      await axios.get(`${API_BASE_URL}/categories`);
      log('✓ Backend is running', 'green');
    } catch (error) {
      log('✗ Backend is not running!', 'red');
      log('Please start the backend server first:', 'yellow');
      log('  cd backend && npm start\n', 'yellow');
      process.exit(1);
    }

    // Step 2: Fetch from WestManga API directly
    log('\n2. Testing WestManga API connection...', 'cyan');
    const westMangaResponse = await axios.get(`${API_BASE_URL}/westmanga/list`, {
      params: { page, per_page: limit }
    });
    
    if (westMangaResponse.data.status && westMangaResponse.data.data) {
      log(`✓ WestManga API responded with ${westMangaResponse.data.data.length} manga`, 'green');
      
      // Show first 3 manga
      log('\nPreview of manga to be synced:', 'blue');
      westMangaResponse.data.data.slice(0, 3).forEach((manga, index) => {
        log(`  ${index + 1}. ${manga.title} (${manga.slug})`, 'reset');
        log(`     Genres: ${manga.genres?.map(g => g.name).join(', ') || 'N/A'}`, 'reset');
        log(`     Rating: ${manga.rating || 'N/A'} | Views: ${manga.total_views || 0}`, 'reset');
      });
      
      if (westMangaResponse.data.data.length > 3) {
        log(`  ... and ${westMangaResponse.data.data.length - 3} more`, 'reset');
      }
    } else {
      log('✗ WestManga API returned invalid data', 'red');
      process.exit(1);
    }

    // Step 3: Perform sync
    log('\n3. Syncing manga to database...', 'cyan');
    const syncResponse = await axios.post(`${API_BASE_URL}/westmanga/sync`, {
      page,
      limit
    });

    if (syncResponse.data) {
      log('✓ Sync completed successfully!', 'green');
      log('\nSync Results:', 'blue');
      log(`  • New manga synced: ${colors.green}${syncResponse.data.synced}${colors.reset}`);
      log(`  • Existing manga updated: ${colors.yellow}${syncResponse.data.updated}${colors.reset}`);
      log(`  • Errors: ${syncResponse.data.errors > 0 ? colors.red : colors.green}${syncResponse.data.errors}${colors.reset}`);
      log(`  • Total processed: ${syncResponse.data.total}`);
    }

    // Step 4: Verify in database
    log('\n4. Verifying synced data...', 'cyan');
    const verifyResponse = await axios.get(`${API_BASE_URL}/manga`, {
      params: { source: 'westmanga', limit: 5 }
    });

    if (verifyResponse.data.manga && verifyResponse.data.manga.length > 0) {
      log(`✓ Found ${verifyResponse.data.totalCount} WestManga manga in database`, 'green');
      log('\nRecent WestManga manga:', 'blue');
      verifyResponse.data.manga.slice(0, 3).forEach((manga, index) => {
        log(`  ${index + 1}. ${manga.title}`, 'reset');
        log(`     Slug: ${manga.slug}`, 'reset');
        log(`     WestManga ID: ${manga.westmanga_id}`, 'reset');
        log(`     Genres: ${manga.genres?.map(g => g.name).join(', ') || 'N/A'}`, 'reset');
      });
    } else {
      log('⚠ No WestManga manga found in database', 'yellow');
    }

    // Step 5: Test manga detail fetch
    if (verifyResponse.data.manga && verifyResponse.data.manga.length > 0) {
      const testSlug = verifyResponse.data.manga[0].slug;
      log(`\n5. Testing manga detail fetch (${testSlug})...`, 'cyan');
      
      const detailResponse = await axios.get(`${API_BASE_URL}/manga/slug/${testSlug}`);
      
      if (detailResponse.data) {
        log('✓ Manga detail fetched successfully', 'green');
        log('\nManga Detail:', 'blue');
        log(`  Title: ${detailResponse.data.title}`);
        log(`  Author: ${detailResponse.data.author || 'N/A'}`);
        log(`  Status: ${detailResponse.data.status}`);
        log(`  Rating: ${detailResponse.data.rating || 'N/A'}`);
        log(`  Chapters: ${detailResponse.data.chapters?.length || 0}`);
        log(`  Is Manual Input: ${detailResponse.data.is_input_manual ? 'Yes' : 'No (WestManga)'}`);
        
        if (detailResponse.data.chapters && detailResponse.data.chapters.length > 0) {
          log(`  Latest Chapter: ${detailResponse.data.chapters[0].number || detailResponse.data.chapters[0].chapter_number}`);
        }
      }
    }

    log('\n=== Test Completed Successfully! ===\n', 'bright');
    log('Next steps:', 'cyan');
    log('1. View all manga: GET /api/manga', 'reset');
    log('2. Filter by source: GET /api/manga?source=westmanga', 'reset');
    log('3. Search manga: GET /api/manga/search?query=tower', 'reset');
    log('4. Get manga detail: GET /api/manga/slug/[SLUG]', 'reset');
    log('\nSee API_DOCUMENTATION.md for complete API reference.\n', 'yellow');

  } catch (error) {
    log('\n✗ Error during test:', 'red');
    if (error.response) {
      log(`Status: ${error.response.status}`, 'red');
      log(`Message: ${error.response.data?.error || error.message}`, 'red');
    } else {
      log(error.message, 'red');
    }
    process.exit(1);
  }
}

// Parse command line arguments
const page = parseInt(process.argv[2]) || 1;
const limit = parseInt(process.argv[3]) || 10;

// Validate arguments
if (page < 1) {
  log('Error: Page must be >= 1', 'red');
  process.exit(1);
}

if (limit < 1 || limit > 100) {
  log('Error: Limit must be between 1 and 100', 'red');
  process.exit(1);
}

log(`Parameters: Page=${page}, Limit=${limit}`, 'blue');

// Run test
testWestMangaSync(page, limit).catch((error) => {
  log('\nUnexpected error:', 'red');
  log(error.message, 'red');
  process.exit(1);
});




