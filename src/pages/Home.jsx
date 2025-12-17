import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import UpdateSection from '../components/UpdateSection';
import PopularSection from '../components/PopularSection';
import { Link } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import homepageData from '../mockdata/homepage-manga.json';

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const popularDaily = homepageData.data?.popular?.daily?.slice(0, 5) || []; // Get first 5 manga

  useEffect(() => {
    AOS.init({
      duration: 600,
      once: true,
      easing: 'ease-out-cubic',
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % popularDaily.length);
    }, 5000); // Auto-slide every 5 seconds

    return () => clearInterval(timer);
  }, [popularDaily.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % popularDaily.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + popularDaily.length) % popularDaily.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="pt-20 pb-4">
      {/* Hero Section with Dark Background */}
      <div className="bg-gray-900 py-12 mb-12" data-aos="fade-up">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-3 tracking-tight">
            KomikNesia
          </h1>
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-6">
            Baca Komik, Manga, Manhwa & Manhua.
          </h2>
          
          {/* Separator Line */}
          <div className="flex justify-center mb-6">
            <div className="flex gap-2">
              {[...Array(14)].map((_, i) => (
                <div key={i} className="w-3 h-1 bg-white rounded-full"></div>
              ))}
            </div>
          </div>
          
          <p className="text-base md:text-lg text-white leading-relaxed max-w-4xl mx-auto">
            KomikNesia merupakan situs baca komik online dengan koleksi terlengkap dan terupdate. 
            Kamu bisa membaca berbagai macam koleksi komik yang kami update setiap hari secara gratis. 
            Website ini adalah tempat terbaik untuk kalian yang ingin Baca Manga (komik Jepang), 
            Manhwa (komik Korea) dan Manhua (komik China) Terbaru.
          </p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      {/* Featured Slider - Popular Daily */}
      <div className="mb-12 relative overflow-hidden" data-aos="fade-up" data-aos-delay="100">
        <div className="relative h-[500px] md:h-[500px] rounded-2xl overflow-hidden">
          {popularDaily.map((item, index) => (
            <div
              key={item.id}
              className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                index === currentSlide ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
              }`}
            >
              {/* Mobile: Full Cover Background */}
              <div className="md:hidden absolute inset-0">
                <img
                  src={item.cover}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
              </div>
              
              {/* Desktop: Gradient Background */}
              <div className="hidden md:block absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, 
                    ${item.color ? 'rgba(99, 102, 241, 0.95)' : 'rgba(15, 23, 42, 0.95)'} 0%, 
                    ${item.color ? 'rgba(139, 92, 246, 0.95)' : 'rgba(30, 41, 59, 0.95)'} 50%,
                    ${item.color ? 'rgba(168, 85, 247, 0.95)' : 'rgba(51, 65, 85, 0.95)'} 100%)`
                }}
              >
                <div className="absolute inset-0 opacity-10" 
                     style={{ 
                       backgroundImage: `url(${item.cover})`,
                       backgroundSize: 'cover',
                       backgroundPosition: 'center',
                       filter: 'blur(20px)',
                       transform: 'scale(1.1)'
                     }}>
                </div>
              </div>
              
              {/* Content Container */}
              <div className="relative h-full flex items-end md:items-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-16 md:pb-0">
                  <div className="grid md:grid-cols-2 gap-8 items-center">
                    {/* Content */}
                    <div className="text-white space-y-3 md:space-y-6">
                      <h2 className="text-2xl md:text-5xl font-bold leading-tight line-clamp-2">
                        {item.title}
                      </h2>
                      
                      <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                        <div className="flex items-center bg-white/20 backdrop-blur-sm px-2.5 py-1 md:px-3 md:py-1.5 rounded-full">
                          <Star className="h-4 w-4 md:h-5 md:w-5 fill-yellow-400 text-yellow-400 mr-1" />
                          <span className="font-bold text-base md:text-lg">{item.rating || 'N/A'}</span>
                        </div>
                        
                        {item.hot && (
                          <span className="bg-red-500 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-semibold">
                            Romance
                          </span>
                        )}
                        
                        <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm capitalize">
                          {item.status}
                        </span>
                      </div>
                      
                      <p className="text-white/90 text-sm md:text-lg line-clamp-2 md:line-clamp-3 max-w-xl">
                        {item.title.split(' ').slice(0, 15).join(' ')}...
                      </p>
                      
                      <div className="hidden md:flex items-center gap-4">
                        <Link
                          to={`/komik/${item.slug}`}
                          className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          Baca Sekarang
                        </Link>
                        <div className="text-white/80 text-sm">
                          <span className="font-semibold">{item.total_views?.toLocaleString()}</span> views
                        </div>
                      </div>
                    </div>
                    
                    {/* Cover Image - Desktop Only */}
                    <div className="hidden md:flex justify-center items-center">
                      <div className="relative group">
                        <div className="absolute -inset-2 bg-white/20 rounded-2xl blur-xl group-hover:bg-white/30 transition-all"></div>
                        <img
                          src={item.cover}
                          alt={item.title}
                          className="relative rounded-xl shadow-2xl w-64 h-96 object-cover transform group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Navigation Arrows - Hidden on Mobile */}
          <button
            onClick={prevSlide}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <button
            onClick={nextSlide}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          
          {/* Dots Indicator */}
          <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {popularDaily.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all rounded-full ${
                  index === currentSlide
                    ? 'bg-white w-8 h-3'
                    : 'bg-white/50 w-3 h-3 hover:bg-white/75'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Update Section */}
        <div data-aos="fade-up" data-aos-delay="200">
          <UpdateSection />
        </div>

        {/* Popular Section */}
        <div data-aos="fade-up" data-aos-delay="300">
          <PopularSection />
        </div>
      </div>
    </div>
  );
};

export default Home;