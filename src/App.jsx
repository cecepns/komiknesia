import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import MangaDetail from "./pages/MangaDetail";
import ChapterReader from "./pages/ChapterReader";
import Library from "./pages/Library";
import Content from "./pages/Content";
import Contact from "./pages/Contact";
import ComingSoon from "./pages/ComingSoon";
import ScrollToTop from "./components/ScrollToTop";
import BottomNavigation from "./components/BottomNavigation";
import AdPopup from "./components/AdPopup";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";

function AppContent() {
  const location = useLocation();
  
  // Don't show AdPopup on admin and login routes
  const shouldShowAdPopup = !location.pathname.startsWith('/admin') && location.pathname !== '/login';

  return (
    <>
      <ScrollToTop />
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
        <Route path="/view/:chapterSlug" element={<ChapterReader />} />
        <Route path="/komik/:slug" element={<MangaDetail />} />
        <Route
          path="/library"
          element={
            <>
              <Layout>
                <Library />
              </Layout>
              <BottomNavigation />
            </>
          }
        />
        <Route
          path="/content"
          element={
            <>
              <Content />
              <BottomNavigation />
            </>
          }
        />
        {/* <Route path="/daftar-komik" element={
          <>
            <ComingSoon title="Daftar Komik" />
            <BottomNavigation />
          </>
        } /> */}
        <Route
          path="/akun"
          element={
            <>
              <ComingSoon title="Akun" />
              <BottomNavigation />
            </>
          }
        />
        <Route
          path="/contact"
          element={
            <>
              <Layout>
                <Contact />
              </Layout>
              <BottomNavigation />
            </>
          }
        />
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
      </Routes>
      {/* AdPopup rendered once for all routes except admin and login */}
      {shouldShowAdPopup && <AdPopup />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
