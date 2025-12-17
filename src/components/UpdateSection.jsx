import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import homepageMangaData from '../mockdata/homepage-manga.json';
import LazyImage from './LazyImage';

const UpdateSection = () => {
  const navigate = useNavigate();
  const [mangaList, setMangaList] = useState([]);

  const countryFlags = {
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'CN': '🇨🇳',
    'US': '🇺🇸',
    'ID': '🇮🇩'
  };

  // Adjust mock data timestamps to be relative to current time
  const adjustMangaTimestamps = useCallback((mangaList) => {
    if (!mangaList || mangaList.length === 0) return [];
    
    // Find the most recent timestamp in the mock data
    let maxTimestamp = 0;
    mangaList.forEach(manga => {
      if (manga.lastChapters && manga.lastChapters.length > 0) {
        const timestamp = manga.lastChapters[0]?.created_at?.time;
        if (timestamp > maxTimestamp) maxTimestamp = timestamp;
      }
    });

    // Calculate the difference between now and the most recent mock timestamp
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = now - maxTimestamp;

    // Adjust all timestamps by the difference
    return mangaList.map(manga => {
      if (!manga.lastChapters || manga.lastChapters.length === 0) return manga;
      
      return {
        ...manga,
        lastChapters: manga.lastChapters.map(chapter => ({
          ...chapter,
          created_at: {
            ...chapter.created_at,
            time: chapter.created_at.time + timeDiff
          }
        }))
      };
    });
  }, []);

  const loadManga = useCallback(() => {
    let result = [];

    if (homepageMangaData?.data?.mirror_update) {
      // Adjust timestamps to be relative to current time
      const adjustedManga = adjustMangaTimestamps(homepageMangaData.data.mirror_update);
      
      // Filter out manga without chapters
      result = adjustedManga.filter(manga => {
        return manga.lastChapters && manga.lastChapters.length > 0;
      });

      // Sort by latest update
      result.sort((a, b) => {
        const timeA = a.lastChapters[0]?.created_at?.time || 0;
        const timeB = b.lastChapters[0]?.created_at?.time || 0;
        return timeB - timeA;
      });

      // Limit to top 20
      result = result.slice(0, 20);
    }

    setMangaList(result);
  }, [adjustMangaTimestamps]);

  useEffect(() => {
    loadManga();
  }, [loadManga]);

  const getTimeAgo = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    const hours = Math.floor(diff / 3600);
    const days = Math.floor(diff / (3600 * 24));
    
    if (hours < 24) {
      return `${hours} jam`;
    } else {
      return `${days} hari`;
    }
  };

  return (
    <div className="mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Update Terbaru
          </h2>
        </div>
      </div>

      {/* Manga Grid */}
      {mangaList.length === 0 ? (
        <div className="text-center py-12 bg-gray-100 dark:bg-primary-900 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada manga update terbaru
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {mangaList.map((manga) => (
            <div
              key={manga.id}
              onClick={() => navigate(`/manga/${manga.slug}`)}
              className="bg-white dark:bg-primary-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
            >
              {/* Cover Image */}
              <div className="relative aspect-[3/4] overflow-hidden">
                <LazyImage
                  src={manga.cover}
                  alt={manga.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  wrapperClassName="w-full h-full"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Country Flag */}
                <div className="absolute top-2 right-2 text-2xl bg-white/90 dark:bg-primary-900/90 rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                  {countryFlags[manga.country_id] || '🌍'}
                </div>
                
                {/* Color Badge */}
                {manga.color && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                    </svg>
                    <span>COLOR</span>
                  </div>
                )}
                
                {/* Hot Badge */}
                {manga.hot && (
                  <div className="absolute bottom-2 left-2 bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1">
                    <span className="text-white text-xs font-bold">HOT</span>
                  </div>
                )}
                
                {/* Title Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">
                    {manga.title}
                  </h3>
                </div>
              </div>

              {/* Info Section */}
              <div className="p-3">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span className="font-medium">
                    Chapter {manga.lastChapters[0]?.number || 'N/A'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-500">
                    {getTimeAgo(manga.lastChapters[0]?.created_at?.time)}
                  </span>
                </div>
                {/* Rating */}
                {manga.rating > 0 && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {manga.rating}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpdateSection;
