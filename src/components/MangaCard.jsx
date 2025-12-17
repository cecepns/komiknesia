import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Eye } from 'lucide-react';
import { apiClient } from '../utils/api';
import LazyImage from './LazyImage';

const MangaCard = ({ manga, onVoteUpdate }) => {
  const navigate = useNavigate();
  const [isVoting, setIsVoting] = useState(false);
  const [votes, setVotes] = useState(manga.votes || 0);

  const handleVote = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isVoting) return;

    try {
      setIsVoting(true);
      await apiClient.voteManga(manga.id, 'up');
      setVotes(prev => prev + 1);
      if (onVoteUpdate) onVoteUpdate(manga.id);
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div 
      onClick={() => navigate(`/komik/${manga.slug}`)}
      className="bg-white dark:bg-primary-900 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <LazyImage
          src={manga.thumbnail || 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400'}
          alt={manga.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          wrapperClassName="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Vote Button */}
        <button
          onClick={handleVote}
          disabled={isVoting}
          className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition-colors disabled:opacity-50"
        >
          <Heart className={`h-4 w-4 ${votes > 0 ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </button>

        {/* Stats Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center space-x-1">
            <Heart className="h-4 w-4" />
            <span>{votes}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Eye className="h-4 w-4" />
            <span>{manga.views || 0}</span>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {manga.title}
        </h3>
        
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span className="bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full text-xs">
            {manga.category_name || 'Uncategorized'}
          </span>
          <span>{manga.author}</span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {manga.synopsis || 'Tidak ada sinopsis tersedia.'}
        </p>
      </div>
    </div>
  );
};

export default MangaCard;