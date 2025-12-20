import { useState, useEffect } from 'react';
import { Mail, MessageCircle, FileText, Loader2 } from 'lucide-react';
import { apiClient } from '../utils/api';

const Contact = () => {
  const [contactInfo, setContactInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getContactInfo(true);
      setContactInfo(data);
    } catch (error) {
      console.error('Error fetching contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatWhatsAppNumber = (number) => {
    if (!number) return '';
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
    }
    return number;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat informasi kontak...</p>
        </div>
      </div>
    );
  }

  if (!contactInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Informasi kontak belum tersedia
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-primary-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Hubungi Kami
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Kami siap membantu menjawab pertanyaan dan mendengarkan saran Anda
          </p>
        </div>

        {/* Contact Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
          {/* Description */}
          {contactInfo.description && (
            <div className="mb-8 text-center">
              <FileText className="h-8 w-8 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
              <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed whitespace-pre-line">
                {contactInfo.description}
              </p>
            </div>
          )}

          {/* Contact Methods */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Email */}
            <a
              href={`mailto:${contactInfo.email}`}
              className="group flex items-start space-x-4 p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl hover:shadow-lg transition-all duration-300"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Mail className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Email
                </h3>
                <p className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                  {contactInfo.email}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Kirim email kepada kami
                </p>
              </div>
            </a>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start space-x-4 p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl hover:shadow-lg transition-all duration-300"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  WhatsApp
                </h3>
                <p className="text-green-600 dark:text-green-400 font-medium group-hover:underline">
                  {formatWhatsAppNumber(contactInfo.whatsapp)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Chat langsung dengan kami
                </p>
              </div>
            </a>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`mailto:${contactInfo.email}?subject=Pertanyaan tentang KomikNesia`}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                <Mail className="h-5 w-5 mr-2" />
                Kirim Email
              </a>
              <a
                href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}?text=Halo, saya ingin bertanya tentang KomikNesia`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Chat WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Kami biasanya merespons dalam waktu 24 jam pada hari kerja
          </p>
        </div>
      </div>
    </div>
  );
};

export default Contact;


