import { useState, useEffect } from 'react';
import { Save, Mail, MessageCircle, FileText, Trash2 } from 'lucide-react';
import { apiClient } from '../../utils/api';

const ContactManager = () => {
  const [contactInfo, setContactInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    whatsapp: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getContactInfo(true);
      if (data) {
        setContactInfo(data);
        setFormData({
          email: data.email || '',
          whatsapp: data.whatsapp || '',
          description: data.description || '',
          is_active: data.is_active !== undefined ? data.is_active : true
        });
      }
    } catch (error) {
      console.error('Error fetching contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.whatsapp) {
      alert('Email dan WhatsApp harus diisi');
      return;
    }

    setSaving(true);
    try {
      if (contactInfo) {
        // Update existing
        await apiClient.updateContactInfo(contactInfo.id, formData);
        alert('Informasi kontak berhasil diperbarui');
      } else {
        // Create new
        await apiClient.createContactInfo(formData);
        alert('Informasi kontak berhasil dibuat');
      }
      await fetchContactInfo();
    } catch (error) {
      console.error('Error saving contact info:', error);
      alert('Error saving contact info: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contactInfo) return;
    
    if (!confirm('Apakah Anda yakin ingin menghapus informasi kontak ini?')) return;

    try {
      await apiClient.deleteContactInfo(contactInfo.id);
      setContactInfo(null);
      setFormData({
        email: '',
        whatsapp: '',
        description: '',
        is_active: true
      });
      alert('Informasi kontak berhasil dihapus');
    } catch (error) {
      console.error('Error deleting contact info:', error);
      alert('Error deleting contact info: ' + (error.message || 'Unknown error'));
    }
  };

  const formatWhatsAppNumber = (number) => {
    // Format: +6281234567890 -> +62 812-3456-7890
    if (!number) return '';
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
    }
    return number;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Manajemen Kontak
        </h3>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Mail className="h-4 w-4 inline-block mr-2" />
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="contact@komiknesia.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MessageCircle className="h-4 w-4 inline-block mr-2" />
              Nomor WhatsApp *
            </label>
            <input
              type="text"
              value={formData.whatsapp}
              onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
              placeholder="+6281234567890"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Format: +6281234567890 (dengan kode negara)
            </p>
            {formData.whatsapp && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Format tampil: {formatWhatsAppNumber(formData.whatsapp)}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="h-4 w-4 inline-block mr-2" />
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Hubungi kami untuk pertanyaan, saran, atau dukungan."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Deskripsi yang akan ditampilkan di halaman kontak
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Aktif (tampilkan di halaman kontak)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Menyimpan...' : contactInfo ? 'Perbarui' : 'Simpan'}
            </button>
            {contactInfo && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Hapus
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Preview */}
      {contactInfo && formData.is_active && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Preview
          </h4>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                <a 
                  href={`mailto:${formData.email}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {formData.email}
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">WhatsApp</p>
                <a 
                  href={`https://wa.me/${formData.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-400 hover:underline"
                >
                  {formatWhatsAppNumber(formData.whatsapp)}
                </a>
              </div>
            </div>
            {formData.description && (
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Deskripsi</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {formData.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactManager;


