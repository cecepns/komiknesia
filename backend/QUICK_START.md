# Quick Start Guide - WestManga Integration

## Prerequisites
- ✅ MySQL database running
- ✅ Database created (komiknesia)
- ✅ Migration file executed
- ✅ Node.js installed

## Step-by-Step Setup

### 1. Run Database Migration

If you haven't run the migration yet:

```bash
# Connect to MySQL
mysql -u root -p

# Run migration
source supabase/migrations/20251216143249_black_fog.sql
```

Or if database already exists, run the ALTER statements from `WESTMANGA_INTEGRATION_COMPLETE.md` section "Migration Path".

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

Dependencies installed:
- express
- mysql2
- multer
- cors
- dotenv
- **axios** (new!)

### 3. Configure Database Connection

Edit `backend/server.js` if needed:

```javascript
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'komiknesia'
};
```

### 4. Start Backend Server

```bash
cd backend
npm start
```

You should see:
```
Connected to MySQL database
Server running on http://localhost:5000
```

### 5. Test WestManga Sync

Open a new terminal and run the test script:

```bash
cd backend
node test-westmanga-sync.js 1 10
```

This will:
1. ✅ Check backend is running
2. ✅ Test WestManga API connection
3. ✅ Sync 10 manga from page 1
4. ✅ Verify data in database
5. ✅ Test manga detail fetch

### 6. Verify Results

**Check synced manga:**
```bash
curl http://localhost:5000/api/manga?source=westmanga
```

**Get specific manga detail:**
```bash
curl http://localhost:5000/api/manga/slug/[SLUG]
```

**Search manga:**
```bash
curl "http://localhost:5000/api/manga/search?query=tower&source=all"
```

## Common Operations

### Sync More Manga

Sync page 2 with 25 manga:
```bash
curl -X POST http://localhost:5000/api/westmanga/sync \
  -H "Content-Type: application/json" \
  -d '{"page": 2, "limit": 25}'
```

Or use test script:
```bash
node test-westmanga-sync.js 2 25
```

### Add Manual Manga

```bash
curl -X POST http://localhost:5000/api/manga \
  -F "title=My Manga" \
  -F "author=Author Name" \
  -F "synopsis=Description" \
  -F "genre_ids=[2,7,10]" \
  -F "content_type=manga" \
  -F "status=ongoing" \
  -F "thumbnail=@/path/to/image.jpg"
```

### Get All Manga (Both Sources)

```bash
curl http://localhost:5000/api/manga
```

### Filter by Source

**Only manual:**
```bash
curl http://localhost:5000/api/manga?source=manual
```

**Only WestManga:**
```bash
curl http://localhost:5000/api/manga?source=westmanga
```

### Search

**Search everywhere:**
```bash
curl "http://localhost:5000/api/manga/search?query=tower&source=all"
```

**Search only local:**
```bash
curl "http://localhost:5000/api/manga/search?query=tower&source=local"
```

**Search only WestManga:**
```bash
curl "http://localhost:5000/api/manga/search?query=tower&source=westmanga"
```

## Testing Different Scenarios

### Scenario 1: Get WestManga Manga Detail
```bash
# This will fetch real-time data from WestManga API
curl http://localhost:5000/api/manga/slug/a-wimps-strategy-guide-to-conquer-the-tower
```

Response includes:
- ✅ Latest chapters from WestManga
- ✅ Updated ratings
- ✅ Current synopsis
- ✅ Bookmark count

### Scenario 2: Get Manual Manga Detail
```bash
# This will fetch complete data from local database
curl http://localhost:5000/api/manga/slug/sample-manga-1
```

Response includes:
- ✅ All data from local DB
- ✅ Chapters stored locally
- ✅ Chapter images

### Scenario 3: Get Chapter Detail (WestManga)
```bash
# Fetches chapter images from WestManga API
curl http://localhost:5000/api/chapters/slug/[CHAPTER-SLUG]
```

### Scenario 4: Browse by Genre
```bash
# Get Action manga (category_id = 2)
curl http://localhost:5000/api/manga?category=2
```

## Troubleshooting

### Backend Won't Start

**Error:** `Database connection failed`

**Solution:**
1. Check MySQL is running: `mysql.server status`
2. Verify database exists: `SHOW DATABASES;`
3. Check credentials in `server.js`

### Sync Fails

**Error:** `Failed to fetch manga from WestManga`

**Solution:**
1. Check internet connection
2. Verify WestManga API is accessible:
   ```bash
   curl https://data.westmanga.me/api/contents
   ```
3. Check backend logs for detailed error

### Manga Detail Returns Empty Chapters

**Possible reasons:**
1. WestManga API is down → Falls back to local data
2. Manga is manual but has no chapters → Add chapters via POST endpoint
3. Network timeout → Check internet connection

### Genres Not Showing

**Solution:**
1. Verify categories are seeded:
   ```sql
   SELECT COUNT(*) FROM categories;
   ```
2. Check manga_genres junction:
   ```sql
   SELECT * FROM manga_genres WHERE manga_id = [ID];
   ```

## Performance Tips

### 1. Sync in Batches
Instead of syncing thousands at once:
```bash
# Sync 5 pages of 25 manga each
for i in {1..5}; do
  node test-westmanga-sync.js $i 25
  sleep 2
done
```

### 2. Index Optimization
Indexes are already created in migration:
- `idx_westmanga_id`
- `idx_is_input_manual`
- `idx_hot`
- `idx_rating`

### 3. Cache Manga List
For production, consider caching the manga list endpoint response.

## Development vs Production

### Development
```bash
# Use nodemon for auto-reload
cd backend
npm run dev
```

### Production
```bash
# Use PM2 or similar process manager
npm install -g pm2
pm2 start backend/server.js --name komiknesia-backend
pm2 save
pm2 startup
```

## Next Steps

1. ✅ **Backend is ready!**
2. 🔄 **Update Frontend** to use new API endpoints
3. 🎨 **Add UI** for WestManga sync button in admin panel
4. 🔍 **Enhance Search** with combined results display
5. 📊 **Add Stats** dashboard for sync monitoring

## API Documentation

For complete API reference, see: `backend/API_DOCUMENTATION.md`

## Support

If you encounter issues:
1. Check backend logs
2. Verify database schema matches migration
3. Test with provided test script
4. Review API_DOCUMENTATION.md

---

**Status:** ✅ Ready to Use

**Last Updated:** December 18, 2024




