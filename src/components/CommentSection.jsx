import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Loader2, Reply } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient, getImageUrl } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

function CommentItem({ comment, onReply, getImageUrl, isAuthenticated }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.postComment({
        manga_id: comment.manga_id || undefined,
        chapter_id: comment.chapter_id || undefined,
        parent_id: comment.id,
        body: replyBody.trim(),
      });
      setReplyBody('');
      setShowReplyForm(false);
      onReply?.();
    } finally {
      setSubmitting(false);
    }
  };

  const avatarUrl = comment.profile_image ? getImageUrl(comment.profile_image) : null;

  return (
    <div className="flex gap-3 py-3 border-b border-primary-800 last:border-0">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-primary-300">
            {(comment.username || 'U').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-200">{comment.username}</span>
          <span className="text-xs text-gray-500">
            {comment.created_at ? new Date(comment.created_at).toLocaleString('id-ID') : ''}
          </span>
        </div>
        <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap break-words">{comment.body}</p>
        {isAuthenticated && (
          <>
            <button
              type="button"
              onClick={() => setShowReplyForm((v) => !v)}
              className="mt-2 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <Reply className="h-3 w-3" />
              Balas
            </button>
            {showReplyForm && (
              <form onSubmit={handleSubmitReply} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Tulis balasan..."
                  className="flex-1 px-3 py-2 rounded-lg bg-primary-800 border border-primary-700 text-gray-100 text-sm placeholder-gray-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyBody.trim() || submitting}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white text-sm flex items-center gap-1"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            )}
          </>
        )}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 pl-4 border-l-2 border-primary-700 space-y-2">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="flex gap-2 py-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center overflow-hidden">
                  {reply.profile_image ? (
                    <img src={getImageUrl(reply.profile_image)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary-300">
                      {(reply.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-300 text-sm">{reply.username}</span>
                    <span className="text-xs text-gray-500">
                      {reply.created_at ? new Date(reply.created_at).toLocaleString('id-ID') : ''}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5 whitespace-pre-wrap break-words">{reply.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ mangaId, chapterId, externalSlug, scope }) {
  const { isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (mangaId) params.manga_id = mangaId;
      if (scope) params.scope = scope;
      if (externalSlug) {
        params.external_slug = externalSlug;
      } else if (chapterId) {
        params.chapter_id = chapterId;
      }
      const res = await apiClient.getComments(params);
      if (res.status && res.data) {
        setComments(res.data);
        const meta = res.meta || {};
        setHasMore(meta.page < meta.totalPages);
      } else {
        setComments([]);
        setHasMore(false);
      }
    } catch {
      setComments([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [mangaId, chapterId, page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Reset to first page when target changes
  useEffect(() => {
    setPage(1);
  }, [mangaId, chapterId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim() || submitting || !isAuthenticated) return;
    setSubmitting(true);
    try {
      await apiClient.postComment({
        manga_id: mangaId || undefined,
        chapter_id: chapterId || undefined,
        external_slug: externalSlug || undefined,
        body: body.trim(),
      });
      setBody('');
      fetchComments();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-primary-900 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        Komentar
      </h3>
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tulis komentar..."
            className="flex-1 px-4 py-3 rounded-lg bg-primary-800 border border-primary-700 text-gray-100 placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={!body.trim() || submitting}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white font-medium flex items-center gap-2"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Kirim
          </button>
        </form>
      ) : (
        <p className="text-gray-400 text-sm mb-4">
          <Link to="/akun" className="text-primary-400 hover:text-primary-300 underline">
            Login
          </Link>{' '}
          untuk mengomentari. Anda hanya dapat melihat komentar saat belum login.
        </p>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-primary-700 rounded-lg">
          <p className="text-gray-400">Belum ada komentar.</p>
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={fetchComments}
                getImageUrl={getImageUrl}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm bg-primary-800 hover:bg-primary-700 rounded-lg text-primary-100 border border-primary-700"
              >
                Tampilkan komentar berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
