## KomikNesia PHP Backend

Backend ini dibangun dengan Lumen dan berfungsi sebagai API utama untuk data manga, chapter, dan gambar.

### Endpoint Import Softkomik

- **Method**: `POST`
- **URL**: `https://be-api.komiknesia.net/api/manga/import-softkomik`
- **Auth**: Wajib JWT/token (middleware `auth`)
- **Content-Type**: `application/json`
- **Controller**: `MangaImportController@importSoftkomik`

#### Struktur Payload

```json
{
  "page": 1,
  "maxPage": 7209,
  "data": [
    {
      "_id": "69b2a79639b610135968473c",
      "title": "Saikyou Juzoku Tensei: Majutsu Otaku no Utopia",
      "post": ["ya", "ya"],
      "status": "ongoing",
      "type": "manga",
      "gambar": "https://cover.softdevices.my.id/softkomik-cover/image-cover-2/saikyou-juzoku-tensei-majutsu-otaku-no-utopia.jpeg",
      "latest_chapter": "012",
      "updated_at": "2026-03-12T11:50:21.161Z",
      "title_slug": "saikyou-juzoku-tensei-majutsu-otaku-no-utopia-bahasa-indonesia",
      "latestChapter": 12,
      "detail": {
        "raw": {
          "_id": "69b2a79639b610135968473c",
          "title": "Saikyou Juzoku Tensei: Majutsu Otaku no Utopia",
          "title_alt": "Reincarnation of sherman, ...",
          "sinopsis": "Saya, yang seharusnya mati setelah ditabrak mobil, ...",
          "author": null,
          "tahun": null,
          "status": "ongoing",
          "type": "manga",
          "gambar": "image-cover-2/saikyou-juzoku-tensei-majutsu-otaku-no-utopia.jpeg",
          "latest_chapter": "012",
          "updated_at": "2026-03-12T11:50:21.161Z",
          "title_slug": "saikyou-juzoku-tensei-majutsu-otaku-no-utopia-bahasa-indonesia",
          "Genre": [
            "Adventure",
            "Comedy",
            "Fantasy",
            "Harem",
            "Romance",
            "Shounen"
          ]
        },
        "description": "Saya, yang seharusnya mati setelah ditabrak mobil, ...",
        "genres": [
          "Adventure",
          "Comedy",
          "Fantasy",
          "Harem",
          "Romance",
          "Shounen"
        ],
        "rating": null,
        "rating_member": null
      },
      "chapters": [
        {
          "chapter": "012",
          "images": [
            "https://cd1.softkomik.online/softkomik/img-file/.../chapter-012/softkomik-0.webp",
            "https://cd1.softkomik.online/softkomik/img-file/.../chapter-012/softkomik-1.webp"
          ]
        },
        {
          "chapter": "011",
          "images": [
            "https://cd1.softkomik.online/softkomik/img-file/.../chapter-011/softkomik-0.webp"
          ]
        }
      ]
    }
  ]
}
```

#### Aturan Penyimpanan

- **Manga**
  - Slug diambil dari `title_slug` jika ada, jika tidak dari `title`.
  - Jika slug sudah ada di tabel `manga` → dipakai sebagai manga existing (tidak membuat manga baru).
  - Jika belum ada → dibuat manga baru dengan:
    - `title`, `author` (jika ada), `synopsis` dari `detail.raw.sinopsis`, `thumbnail` dari `gambar`,
    - `status` dari `status` (default `ongoing`),
    - `content_type` dari `type` (default `manga`),
    - `is_input_manual = false`, `source = "softkomik"`.

- **Chapter**
  - Menggunakan field `chapter` sebagai `chapter_number` (string, misal `"012"`, `"007.5"`, `"0010"`).
  - Jika kombinasi `manga_id + chapter_number` sudah ada di tabel `chapters` → chapter dilewati (tidak duplikat).
  - Jika belum ada → dibuat chapter baru dengan:
    - `title = "Chapter {chapter_number}"`,
    - `chapter_number = chapter`,
    - `slug = "{manga_slug}-chapter-{chapter_number}"`.

- **Chapter Images**
  - Field `images` berisi array URL string.
  - Duplikat di dalam array akan difilter (`array_unique`) dan URL kosong di-skip.
  - Untuk setiap URL:
    - Jika sudah ada di `chapter_images` untuk `chapter_id` tersebut → dilewati.
    - Jika belum ada → dibuat baris baru dengan:
      - `chapter_id` sesuai chapter,
      - `image_path` = URL,
      - `page_number` berurutan setelah `max(page_number)` yang sudah ada.

#### Contoh Response Sukses

```json
{
  "status": true,
  "message": "Import softkomik selesai",
  "summary": {
    "manga_created": 1,
    "manga_existing": 0,
    "chapters_created": 10,
    "chapters_skipped_existing": 0,
    "images_created": 300
  }
}
```

