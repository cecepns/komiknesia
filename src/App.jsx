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
import Akun from "./pages/Akun";
import Leaderboard from "./pages/Leaderboard";
import Premium from "./pages/Premium";
import ProfileUser from "./pages/ProfileUser";
import Jadwal from "./pages/Jadwal";
import ScrollToTop from "./components/ScrollToTop";
import AdPopup from "./components/AdPopup";
import MbuhRedirectScript from "./components/MbuhRedirectScript";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppContent() {
  const location = useLocation();
  const { user } = useAuth();

  const shouldShowAdPopup =
    !location.pathname.startsWith('/admin') &&
    location.pathname !== '/login' &&
    !user?.membership_active;

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requireAdmin>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route path="/view/:chapterSlug" element={<ChapterReader />} />
        <Route path="/komik/:slug" element={<MangaDetail />} />
        <Route path="/profile/:username" element={<ProfileUser />} />
        <Route
          path="/library"
          element={
            <Layout>
              <Library />
            </Layout>
          }
        />
        <Route
          path="/jadwal"
          element={
            <Layout>
              <Jadwal />
            </Layout>
          }
        />
        <Route
          path="/content"
          element={
            <Layout>
              <Content />
            </Layout>
          }
        />
        <Route
          path="/akun"
          element={
            <Layout>
              <Akun />
            </Layout>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <Layout>
              <Leaderboard />
            </Layout>
          }
        />
        <Route
          path="/premium"
          element={
            <Layout>
              <Premium />
            </Layout>
          }
        />
        <Route
          path="/contact"
          element={
            <Layout>
              <Contact />
            </Layout>
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
      {shouldShowAdPopup && <AdPopup />}
      <MbuhRedirectScript />
      <ToastContainer position="top-right" autoClose={2500} theme="colored" />
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
