import PropTypes from 'prop-types';
import comingSoonImage from '../assets/coming-soon.jpg';

const ComingSoon = ({ title = "Coming Soon" }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex items-center justify-center px-4 py-8 pb-24 md:pb-8">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl overflow-hidden shadow-2xl">
          <div className="relative aspect-video">
            <img
              src={comingSoonImage}
              alt="Coming Soon"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                {title}
              </h1>
              <p className="text-gray-300 text-lg">
                Fitur ini sedang dalam pengembangan. Mohon tunggu ya! 🚀
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

ComingSoon.propTypes = {
  title: PropTypes.string
};

export default ComingSoon;
