import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Admin from './pages/Admin';
import MangaDetail from './pages/MangaDetail';
import ChapterReader from './pages/ChapterReader';
import Library from './pages/Library';
import ComingSoon from './pages/ComingSoon';
import ScrollToTop from './components/ScrollToTop';
import BottomNavigation from './components/BottomNavigation';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/komik/:mangaSlug/chapter/:chapterSlug" element={<ChapterReader />} />
        <Route path="/komik/:slug" element={<MangaDetail />} />
        <Route path="/library" element={
          <>
            <Library />
            <BottomNavigation />
          </>
        } />
        <Route path="/daftar-komik" element={
          <>
            <ComingSoon title="Daftar Komik" />
            <BottomNavigation />
          </>
        } />
        <Route path="/akun" element={
          <>
            <ComingSoon title="Akun" />
            <BottomNavigation />
          </>
        } />
        <Route path="/" element={
          <Layout>
            <Home />
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;