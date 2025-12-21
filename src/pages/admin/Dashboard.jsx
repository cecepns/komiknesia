import { useState, useEffect } from 'react';
import { ChartBar as BarChart3, BookOpen, List, FileText } from 'lucide-react';
import { apiClient } from '../../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalManga: 0,
    totalCategories: 0,
    totalViews: 0,
    totalAds: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await apiClient.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsDisplay = [
    { label: 'Total Manga', value: stats.totalManga.toLocaleString(), icon: BookOpen, color: 'text-blue-600' },
    { label: 'Total Kategori', value: stats.totalCategories.toLocaleString(), icon: List, color: 'text-green-600' },
    { label: 'Total Views', value: stats.totalViews.toLocaleString(), icon: BarChart3, color: 'text-purple-600' },
    { label: 'Total Iklan', value: stats.totalAds.toLocaleString(), icon: FileText, color: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsDisplay.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {loading ? '...' : stat.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Selamat Datang di Admin Panel Komiknesia
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Gunakan menu di sebelah kiri untuk mengelola konten website Komiknesia.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;




