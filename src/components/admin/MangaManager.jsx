import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Eye, Upload } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { apiClient } from '../../utils/api';
import { compressImage } from '../../utils/imageCompression';
import LazyImage from '../LazyImage';

const MangaManager = () => {
  const [manga, setManga] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingManga, setEditingManga] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    synopsis: '',
    category_id: '',
  });
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    fetchManga();
    fetchCategories();
  }, []);

  const fetchManga = async () => {
    try {
      const response = await apiClient.getManga(1, 100);
      setManga(response.manga);
    } catch (error) {
      console.error('Error fetching manga:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories();
      setCategories(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  };

  const handleImageUpload = async (file, type) => {
    try {
      const compressed = await compressImage(file);
      if (type === 'thumbnail') {
        setThumbnailFile(compressed);
      } else {
        setCoverFile(compressed);
      }
    } catch (error) {
      console.error('Error compressing image:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const submitData = new FormData();
    submitData.append('title', formData.title);
    submitData.append('slug', generateSlug(formData.title));
    submitData.append('author', formData.author);
    submitData.append('synopsis', formData.synopsis);
    submitData.append('category_id', formData.category_id);
    
    if (thumbnailFile) {
      submitData.append('thumbnail', thumbnailFile);
    }
    if (coverFile) {
      submitData.append('cover_background', coverFile);
    }

    try {
      if (editingManga) {
        await apiClient.updateManga(editingManga.id, submitData);
      } else {
        await apiClient.createManga(submitData);
      }
      
      setShowForm(false);
      setEditingManga(null);
      setFormData({ title: '', author: '', synopsis: '', category_id: '' });
      setThumbnailFile(null);
      setCoverFile(null);
      fetchManga();
    } catch (error) {
      console.error('Error saving manga:', error);
    }
  };

  const handleEdit = (item) => {
    setEditingManga(item);
    setFormData({
      title: item.title,
      author: item.author,
      synopsis: item.synopsis,
      category_id: item.category_id,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus manga ini?')) return;

    try {
      await apiClient.deleteManga(id);
      fetchManga();
    } catch (error) {
      console.error('Error deleting manga:', error);
    }
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
          Manajemen Manga
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Manga
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">
                {editingManga ? 'Edit Manga' : 'Tambah Manga Baru'}
              </h4>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Judul Manga
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Author
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategori
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Thumbnail (Max 500KB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0], 'thumbnail')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cover Background (Max 500KB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0], 'cover')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sinopsis
                  </label>
                  <ReactQuill
                    theme="snow"
                    value={formData.synopsis}
                    onChange={(value) => setFormData(prev => ({ ...prev, synopsis: value }))}
                    className="bg-white dark:bg-gray-700"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingManga(null);
                      setFormData({ title: '', author: '', synopsis: '', category_id: '' });
                      setThumbnailFile(null);
                      setCoverFile(null);
                    }}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                  >
                    {editingManga ? 'Update' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manga Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {manga.map((item) => (
          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="aspect-[3/4] relative">
              <LazyImage
                src={item.thumbnail || 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400'}
                alt={item.title}
                className="w-full h-full object-cover"
                wrapperClassName="w-full h-full"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-opacity duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <Edit2 className="h-4 w-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1 line-clamp-1">
                {item.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {item.author}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full">
                  {item.category_name}
                </span>
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <Eye className="h-3 w-3 mr-1" />
                  {item.votes || 0}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MangaManager;