import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet-async';
import comingSoonImage from '../assets/coming-soon.png';
import Header from '../components/Header';

const ComingSoon = ({ title = "Coming Soon" }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Helmet>
        <title>{title} | KomikNesia</title>
        <meta name="description" content={`Fitur ${title} sedang dalam pengembangan. Mohon tunggu update terbaru dari KomikNesia.`} />
      </Helmet>
      
      {/* Header */}
      <Header />
      
      <div className="flex items-center justify-center px-4 py-8 pb-24 md:pb-8 pt-24">
        <div className="max-w-2xl w-full">
          <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl overflow-hidden shadow-2xl">
            {/* Image Section */}
            <div className="aspect-video">
              <img
                src={comingSoonImage}
                alt="Coming Soon"
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Content Section */}
            <div className="p-8 text-center">
              <h1 className="text-2xl md:text-4xl md:text-5xl font-bold text-white mb-4">
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
