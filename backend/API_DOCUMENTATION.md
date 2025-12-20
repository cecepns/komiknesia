# Komiknesia Backend API Documentation

## Base URL
```
http://localhost:5000/api
```

## Table of Contents
- [Manga Endpoints](#manga-endpoints)
- [WestManga Integration Endpoints](#westmanga-integration-endpoints)
- [Chapters Endpoints](#chapters-endpoints)
- [Categories Endpoints](#categories-endpoints)
- [Votes Endpoints](#votes-endpoints)
- [Ads Endpoints](#ads-endpoints)

---

## Manga Endpoints

### Get Manga List
Retrieve paginated list of manga with optional filtering.

**Endpoint:** `GET /manga`

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 12) - Items per page
- `search` (string) - Search by title or alternative name
- `category` (number) - Filter by category ID
- `source` (string: 'all' | 'manual' | 'westmanga') - Filter by data source

**Response:**
```json
{
  "manga": [
    {
      "id": 1,
      "title": "Manga Title",
      "slug": "manga-title",
      "author": "Author Name",
      "thumbnail": "/uploads/...",
      "is_input_manual": true,
      "genres": [
        { "id": 1, "name": "Action", "slug": "action" }
      ],
      ...
    }
  ],
  "totalPages": 10,
  "currentPage": 1,
  "totalCount": 120
}
```

---

### Get Manga Detail by Slug
Get detailed information about a manga.

**Endpoint:** `GET /manga/slug/:slug`

**Behavior:**
- If `is_input_manual = true`: Returns data from local database including chapters
- If `is_input_manual = false`: Fetches real-time data from WestManga API

**Response:**
```json
{
  "id": 1,
  "title": "Manga Title",
  "slug": "manga-title",
  "alternative_name": "Alt Title",
  "author": "Author Name",
  "synopsis": "Description...",
  "thumbnail": "/uploads/...",
  "is_input_manual": true,
  "genres": [...],
  "chapters": [...],
  "rating": 8.5,
  "views": 1000,
  ...
}
```

---

### Create Manga (Manual Input)
Create a new manga entry (sets `is_input_manual = true`).

**Endpoint:** `POST /manga`

**Content-Type:** `multipart/form-data`

**Body:**
- `title` (string, required) - Manga title
- `author` (string) - Author name
- `synopsis` (text) - Description
- `alternative_name` (string) - Alternative title
- `content_type` (string) - Type: manga, manhwa, manhua, comic
- `country_id` (string) - Country code: JP, KR, CN, etc.
- `release` (number) - Release year
- `status` (string) - Status: ongoing, completed, hiatus
- `category_id` (number) - Primary category ID
- `genre_ids` (array/JSON) - Array of genre IDs
- `thumbnail` (file) - Cover image
- `cover_background` (file) - Background image

**Response:**
```json
{
  "id": 123,
  "message": "Manga created successfully"
}
```

---

### Update Manga
Update existing manga entry.

**Endpoint:** `PUT /manga/:id`

**Content-Type:** `multipart/form-data`

**Body:** Same as Create Manga endpoint

**Response:**
```json
{
  "message": "Manga updated successfully"
}
```

---

### Delete Manga
Delete a manga entry.

**Endpoint:** `DELETE /manga/:id`

**Response:**
```json
{
  "message": "Manga deleted successfully"
}
```

---

### Search Manga
Search manga across local database and/or WestManga API.

**Endpoint:** `GET /manga/search`

**Query Parameters:**
- `query` (string, required) - Search query
- `source` (string: 'all' | 'local' | 'westmanga') - Search source

**Response:**
```json
{
  "local": [...],
  "westmanga": [...],
  "total": 25
}
```

---

## WestManga Integration Endpoints

### Get WestManga List
Fetch manga list directly from WestManga API (proxy endpoint).

**Endpoint:** `GET /westmanga/list`

**Query Parameters:**
- `page` (number, default: 1)
- `per_page` (number, default: 25)
- `search` (string)
- `genre` (string)
- `status` (string)
- `type` (string)
- `sort` (string)

**Response:** WestManga API format

---

### Sync Manga from WestManga
Import/sync manga from WestManga to local database.

**Endpoint:** `POST /westmanga/sync`

**Body:**
```json
{
  "page": 1,
  "limit": 25
}
```

**Behavior:**
- Fetches manga from WestManga API
- Checks if manga exists (by `westmanga_id`)
- Inserts new manga or updates existing
- Maps genres to local categories
- Sets `is_input_manual = false`

**Response:**
```json
{
  "message": "Sync completed",
  "synced": 20,
  "updated": 5,
  "errors": 0,
  "total": 25
}
```

---

## Chapters Endpoints

### Get Manga Chapters
Get all chapters for a specific manga.

**Endpoint:** `GET /manga/:mangaId/chapters`

**Response:**
```json
[
  {
    "id": 1,
    "manga_id": 1,
    "title": "Chapter 1",
    "chapter_number": "1",
    "slug": "manga-title-chapter-1",
    "cover": "/uploads/...",
    "image_count": 20,
    ...
  }
]
```

---

### Get Chapter Detail by Slug
Get chapter detail with images.

**Endpoint:** `GET /chapters/slug/:slug`

**Behavior:**
- If manga `is_input_manual = true`: Returns data from local database with images
- If manga `is_input_manual = false`: Fetches real-time data from WestManga API

**Response:**
```json
{
  "id": 1,
  "manga_id": 1,
  "title": "Chapter 1",
  "chapter_number": "1",
  "slug": "manga-title-chapter-1",
  "images": [
    { "image_path": "/uploads/...", "page_number": 1 }
  ],
  ...
}
```

---

### Create Chapter
Create a new chapter for manual manga.

**Endpoint:** `POST /manga/:mangaId/chapters`

**Content-Type:** `multipart/form-data`

**Body:**
- `title` (string, required)
- `chapter_number` (string, required)
- `cover` (file, optional)

---

### Upload Chapter Images
Upload images for a chapter.

**Endpoint:** `POST /chapters/:chapterId/images`

**Content-Type:** `multipart/form-data`

**Body:**
- `images` (files, max 50)

---

## Categories Endpoints

### Get All Categories
**Endpoint:** `GET /categories`

**Response:**
```json
[
  {
    "id": 1,
    "name": "Action",
    "slug": "action",
    "manga_count": 150,
    ...
  }
]
```

---

## Votes Endpoints

### Submit Vote
**Endpoint:** `POST /votes`

**Body:**
```json
{
  "manga_id": 1,
  "vote_type": "up"
}
```

---

## Ads Endpoints

### Get All Ads
**Endpoint:** `GET /ads`

### Create Ad
**Endpoint:** `POST /ads`

### Update Ad
**Endpoint:** `PUT /ads/:id`

### Delete Ad
**Endpoint:** `DELETE /ads/:id`

---

## Data Source Strategy

### Manual Input (`is_input_manual = true`)
- Full data stored in local database
- Complete chapter content and images
- Used for self-hosted manga

### WestManga Integration (`is_input_manual = false`)
- Only metadata stored locally (title, thumbnail, genres, etc.)
- Detail & chapters fetched real-time from WestManga API
- Always up-to-date with WestManga content
- Saves storage space

---

## Database Schema Notes

### Many-to-Many Genres
- `manga_genres` junction table connects manga with multiple categories
- Both `category_id` (primary category) and `manga_genres` (all genres) are supported

### WestManga Tracking
- `westmanga_id` - Tracks original WestManga manga ID
- `westmanga_chapter_id` - Tracks original WestManga chapter ID

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error




