import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Loader2, Reply, Smile, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient, getImageUrl } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import vipProfileBanner from '../assets/gif/banner-vip.gif';

const STICKER_MESSAGE_PREFIX = 'KN_STICKER:';

function parseStickerMessage(text) {
  if (typeof text !== 'string' || !text.startsWith(STICKER_MESSAGE_PREFIX)) return null;
  const path = text.slice(STICKER_MESSAGE_PREFIX.length).trim();
  return path || null;
}

function stickersFromApiResponse(res) {
  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function isTruthyLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'active';
  }
  return false;
}

function isVipUser(entity) {
  const role = String(entity?.role || '').trim().toLowerCase();
  if (role === 'vip' || role === 'premium') return true;
  if (isTruthyLike(entity?.membership_active)) return true;
  if (!isTruthyLike(entity?.is_membership)) return false;
  if (!entity?.membership_expires_at) return true;
  const expiresAt = new Date(entity.membership_expires_at);
  if (Number.isNaN(expiresAt.getTime())) return true;
  return expiresAt.getTime() >= Date.now();
}

function renderCommentBody(text) {
  const imagePath = parseStickerMessage(text);
  if (imagePath) {
    return (
      <div className="mt-1">
        <img
          src={getImageUrl(imagePath)}
          alt="Stiker"
          className="max-h-40 max-w-[min(100%,220px)] rounded-lg object-contain bg-black/30"
          loading="lazy"
        />
      </div>
    );
  }
  return <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap break-words">{text}</p>;
}

function CommentItem({ comment, onReply, getImageUrl, isAuthenticated, currentUser }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUser && comment.user_id === currentUser.id;
  const isVipComment = isVipUser(comment);
  const displayName = comment.name || comment.username || 'User';

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

  const deleteCommentById = async (id) => {
    if (deleting) return;
    const ok = window.confirm('Hapus komentar ini?');
    if (!ok) return;
    setDeleting(true);
    try {
      await apiClient.deleteComment(id);
      onReply?.();
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    await deleteCommentById(comment.id);
  };

  return (
    <div className="flex gap-3 py-3 border-b border-primary-800 last:border-0">
      {!isVipComment && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-primary-300">
              {(comment.username || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {isVipComment ? (
          <div className="mb-2">
            <div className="relative h-14 md:h-32 overflow-hidden rounded-xl">
              <img
                src={vipProfileBanner}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-between gap-2 px-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 md:h-12 md:w-12 rounded-full overflow-hidden bg-white shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary-700 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-200">
                          {(comment.username || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm md:text-base truncate">{displayName}</p>
                    <span className="text-[11px] md:text-xs text-gray-200">
                      {comment.created_at ? new Date(comment.created_at).toLocaleString('id-ID') : ''}
                    </span>
                  </div>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                    aria-label="Hapus komentar"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-200">{comment.username}</span>
            <span className="text-xs text-gray-500">
              {comment.created_at ? new Date(comment.created_at).toLocaleString('id-ID') : ''}
            </span>
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                aria-label="Hapus komentar"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
        {renderCommentBody(comment.body)}
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
                {!isVipUser(reply) && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center overflow-hidden">
                    {reply.profile_image ? (
                      <img src={getImageUrl(reply.profile_image)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-primary-300">
                        {(reply.username || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {isVipUser(reply) ? (
                    <div className="mb-2">
                      <div className="relative h-12 md:h-16 overflow-hidden rounded-lg">
                        <img
                          src={vipProfileBanner}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-between gap-2 px-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 md:h-9 md:w-9 rounded-full overflow-hidden bg-white shrink-0">
                              {reply.profile_image ? (
                                <img src={getImageUrl(reply.profile_image)} alt={reply.username} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-primary-700 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary-200">
                                    {(reply.username || 'U').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white text-xs truncate">{reply.name || reply.username || 'User'}</p>
                              <span className="text-[10px] text-gray-200">
                                {reply.created_at ? new Date(reply.created_at).toLocaleString('id-ID') : ''}
                              </span>
                            </div>
                          </div>
                          {currentUser && reply.user_id === currentUser.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCommentById(reply.id);
                              }}
                              disabled={deleting}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                              aria-label="Hapus balasan"
                            >
                              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-300 text-sm">{reply.username}</span>
                      <span className="text-xs text-gray-500">
                        {reply.created_at ? new Date(reply.created_at).toLocaleString('id-ID') : ''}
                      </span>
                      {currentUser && reply.user_id === currentUser.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCommentById(reply.id);
                          }}
                          disabled={deleting}
                          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                          aria-label="Hapus balasan"
                        >
                          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-gray-400 text-sm mt-0.5 whitespace-pre-wrap break-words">{renderCommentBody(reply.body)}</div>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowReplyForm(true);
                        // optional: prefill mention
                        if (!replyBody) {
                          setReplyBody(`@${reply.username} `);
                        }
                      }}
                      className="mt-1 text-[11px] text-purple-400 hover:text-purple-300"
                    >
                      Balas
                    </button>
                  )}
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
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [stickersError, setStickersError] = useState('');
  const stickerToggleRef = useRef(null);
  const stickerTrayRef = useRef(null);

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
  }, [mangaId, chapterId, externalSlug, scope, page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Reset to first page when target changes
  useEffect(() => {
    setPage(1);
  }, [mangaId, chapterId, externalSlug, scope]);

  useEffect(() => {
    if (!stickerPickerOpen || !isAuthenticated) return undefined;
    const load = async () => {
      setStickersLoading(true);
      setStickersError('');
      try {
        const res = await apiClient.getStickers({ page: 1, limit: 50 });
        setStickers(stickersFromApiResponse(res));
      } catch (err) {
        setStickersError(err?.message || 'Gagal memuat stiker');
        setStickers([]);
      } finally {
        setStickersLoading(false);
      }
    };
    load();
  }, [stickerPickerOpen, isAuthenticated]);

  useEffect(() => {
    if (!stickerPickerOpen) return undefined;
    const onPointerDown = (e) => {
      if (stickerToggleRef.current?.contains(e.target)) return;
      if (stickerTrayRef.current?.contains(e.target)) return;
      setStickerPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [stickerPickerOpen]);

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

  const handlePickSticker = async (imagePath) => {
    const path = String(imagePath || '').trim();
    if (!path || submitting || !isAuthenticated) return;
    setSubmitting(true);
    setStickerPickerOpen(false);
    try {
      await apiClient.postComment({
        manga_id: mangaId || undefined,
        chapter_id: chapterId || undefined,
        external_slug: externalSlug || undefined,
        body: `${STICKER_MESSAGE_PREFIX}${path}`,
      });
      fetchComments();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-primary-900 rounded-lg p-6 md:p-8 md:min-h-[560px]">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        Komentar
      </h3>
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-6 space-y-2">
          {stickerPickerOpen && (
            <div
              ref={stickerTrayRef}
              className="rounded-xl border border-primary-700 bg-primary-950/60 p-2"
              role="region"
              aria-label="Pilih stiker komentar"
            >
              <p className="px-1 pb-2 text-xs font-semibold text-gray-400">Stiker</p>
              <div className="max-h-40 overflow-y-auto">
                {stickersLoading ? (
                  <div className="py-4 text-center text-xs text-gray-500">Memuat stiker...</div>
                ) : stickersError ? (
                  <div className="py-4 px-2 text-center text-xs text-red-400">{stickersError}</div>
                ) : stickers.length === 0 ? (
                  <div className="py-4 text-center text-xs text-gray-500">Belum ada stiker.</div>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                    {stickers.map((sticker) => (
                      <button
                        key={sticker.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => handlePickSticker(sticker.image_path)}
                        title={sticker.name || 'Stiker'}
                        className="aspect-square rounded-lg bg-primary-800/70 border border-primary-700 p-1.5 hover:bg-primary-700 disabled:opacity-50 transition-colors"
                      >
                        <img
                          src={getImageUrl(sticker.image_path)}
                          alt={sticker.name || ''}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-3 rounded-lg bg-primary-800 border border-primary-700 text-gray-100 placeholder-gray-500"
            />
            <button
              ref={stickerToggleRef}
              type="button"
              onClick={() => setStickerPickerOpen((open) => !open)}
              disabled={submitting}
              className="px-3 py-3 bg-primary-800 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-gray-200 border border-primary-700 transition-colors"
              title={stickerPickerOpen ? 'Tutup panel stiker' : 'Buka stiker'}
              aria-expanded={stickerPickerOpen}
            >
              <Smile className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white font-medium flex items-center gap-2"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Kirim
            </button>
          </div>
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
                currentUser={user}
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
