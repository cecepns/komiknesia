import { useNavigate } from 'react-router-dom';
import Logo from '../assets/logo.png';

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-gray-900 pb-20 dark:bg-primary-950 text-gray-300 dark:text-gray-400 border-t border-gray-800 dark:border-primary-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo */}
          <div className="flex items-center">
            <img 
              src={Logo} 
              alt="KomikNesia" 
              className="w-36 md:w-44 h-auto cursor-pointer" 
              onClick={() => navigate('/')}
            />
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-gray-300 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => navigate('/content')}
              className="text-gray-400 hover:text-gray-300 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              Daftar Komik
            </button>
            <button
              onClick={() => navigate('/library')}
              className="text-gray-400 hover:text-gray-300 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              Library
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="text-gray-400 hover:text-gray-300 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              Kontak Kami
            </button>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300 dark:text-gray-300">
              Copyright ©2025 KomikNesia, All Rights Reserved.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="text-center max-w-3xl">
            <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              Semua komik di website ini hanya preview dari komik aslinya, mungkin terdapat banyak kesalahan bahasa, nama tokoh, dan alur cerita. Untuk versi aslinya, silahkan beli komiknya jika tersedia di kotamu.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;










