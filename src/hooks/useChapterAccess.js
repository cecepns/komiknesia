import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { requiresChapterLogin } from '../utils/chapterAccess';

export function useChapterAccess() {
  const { isAuthenticated } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);

  const openChapter = useCallback(
    (navigate, chapter, _isLatest, pathOverride) => {
      const path = pathOverride || (chapter?.slug ? `/view/${chapter.slug}` : null);
      if (!path) return false;

      if (requiresChapterLogin(chapter, isAuthenticated)) {
        setPendingPath(path);
        setLoginOpen(true);
        return false;
      }

      navigate(path);
      return true;
    },
    [isAuthenticated],
  );

  const handleLoginSuccess = useCallback(
    (navigate) => {
      if (pendingPath) {
        navigate(pendingPath);
        setPendingPath(null);
      }
      setLoginOpen(false);
    },
    [pendingPath],
  );

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
    setPendingPath(null);
  }, []);

  return {
    loginOpen,
    setLoginOpen,
    openChapter,
    handleLoginSuccess,
    closeLogin,
    pendingPath,
  };
}
