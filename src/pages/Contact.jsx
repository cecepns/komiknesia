import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Mail, Send, FileText, Loader2 } from 'lucide-react';
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

  const telegramUrl = contactInfo?.telegram || 'https://t.me/KomikNesiaOfficial';
  const emailAddress = contactInfo?.email || 'admin@komiknesia.net';

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-400">Memuat informasi kontak...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Hubungi Kami | KomikNesia</title>
        <meta name="description" content="Hubungi tim KomikNesia melalui email atau Telegram. Kami siap membantu menjawab pertanyaan dan mendengarkan saran Anda." />
      </Helmet>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-4">
            Hubungi Kami
          </h1>
          <p className="text-lg text-gray-400">
            Kami siap membantu menjawab pertanyaan dan mendengarkan saran Anda
          </p>
        </div>

        {/* Contact Info Card */}
        <div className="bg-white/[0.05] border border-white/10 rounded-2xl shadow-2xl p-8 md:p-12 backdrop-blur-md">
          {/* Description */}
          {contactInfo?.description && (
            <div className="mb-8 text-center">
              <FileText className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-line">
                {contactInfo.description}
              </p>
            </div>
          )}

          {/* Contact Methods: Email & Telegram */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Email */}
            <a
              href={`mailto:${emailAddress}`}
              className="group flex items-start gap-4 p-6 bg-white/[0.04] border border-white/10 hover:border-red-500/50 rounded-xl hover:shadow-xl transition-all duration-300"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                  <Mail className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Email
                </h3>
                <p className="text-red-400 font-medium group-hover:underline break-all">
                  {emailAddress}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Kirim email kepada kami
                </p>
              </div>
            </a>

            {/* Telegram */}
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 p-6 bg-white/[0.04] border border-white/10 hover:border-sky-500/50 rounded-xl hover:shadow-xl transition-all duration-300"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                  <Send className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Telegram
                </h3>
                <p className="text-sky-400 font-medium group-hover:underline break-words">
                  @KomikNesiaOfficial
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Chat Telegram dengan kami
                </p>
              </div>
            </a>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`mailto:${emailAddress}?subject=Pertanyaan tentang KomikNesia`}
                className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg transition-all"
              >
                <Mail className="h-5 w-5 mr-2" />
                Kirim Email
              </a>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-lg transition-all"
              >
                <Send className="h-5 w-5 mr-2" />
                Chat Telegram
              </a>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Kami biasanya merespons dalam waktu 24 jam pada hari kerja
          </p>
        </div>
      </div>
    </div>
  );
};

export default Contact;
