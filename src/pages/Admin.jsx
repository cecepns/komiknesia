import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout';
import CategoryManager from '../components/admin/CategoryManager';
import MangaManager from '../components/admin/MangaManager';
import Dashboard from './admin/Dashboard';
import AdsManager from './admin/AdsManager';

const Admin = () => {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="categories" element={<CategoryManager />} />
        <Route path="manga" element={<MangaManager />} />
        <Route path="ads" element={<AdsManager />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </AdminLayout>
  );
};

export default Admin;