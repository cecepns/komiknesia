import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Admin from './pages/Admin';
import MangaDetail from './pages/MangaDetail';
import ChapterReader from './pages/ChapterReader';
import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/manga/:mangaSlug/chapter/:chapterSlug" element={<ChapterReader />} />
        <Route path="/manga/:slug" element={<MangaDetail />} />
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