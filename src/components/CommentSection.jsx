import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Loader2, Reply, Smile, Trash2, Eye, EyeOff, Image as ImageIcon, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient, getImageUrl } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import vipProfileBanner from '../assets/gif/banner-vip.gif';
import { toast } from 'react-toastify';

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

function SpoilerBlock({ content }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setRevealed(true);
        }}
        className="my-1.5 inline-flex items-center gap-1.5 rounded-xl bg-red-950/80 border border-red-700/60 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900 transition-colors cursor-pointer select-none shadow-md"
        title="Klik untuk membuka spoiler"
      >
        <EyeOff className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span>SPOILER (Klik untuk membuka)</span>
      </span>
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setRevealed(false);
      }}
      className="my-1.5 block rounded-xl bg-white/[0.05] border-l-4 border-red-500 p-3 text-sm text-gray-200 cursor-pointer hover:bg-white/[0.08] transition-colors"
      title="Klik untuk menyembunyikan spoiler"
    >
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-400 mb-1 flex items-center gap-1 select-none">
        <Eye className="h-3 w-3" /> SPOILER (Klik untuk tutup)
      </span>
      <span>{content}</span>
    </span>
  );
}

function parseFormattedText(text, keyPrefix = 'fmt') {
  if (!text) return null;

  // Handles both standard [img]path[/img] and unclosed img]path or img]path[/img
  const regex = /\[?(img|b|i|s)\]([\s\S]*?)(?:\[\/\1\]|(?=\s|$|\[(?:img|b|i|s)\]))/gi;
  const elements = [];
  let lastIdx = 0;
  let m;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      elements.push(text.slice(lastIdx, m.index));
    }
    const tag = m[1].toLowerCase();
    let val = m[2] ? m[2].trim() : '';
    // Clean up potential trailing [/ or [/img if present in val
    if (tag === 'img') {
      val = val.replace(/\[\/?img\]?/gi, '').trim();
    }
    const key = `${keyPrefix}-${m.index}`;

    if (tag === 'b') {
      elements.push(<strong key={key} className="font-bold text-white">{val}</strong>);
    } else if (tag === 'i') {
      elements.push(<em key={key} className="italic">{val}</em>);
    } else if (tag === 's') {
      elements.push(<del key={key} className="line-through text-gray-400">{val}</del>);
    } else if (tag === 'img') {
      if (val) {
        elements.push(
          <div key={key} className="my-2 max-w-sm rounded-xl overflow-hidden border border-white/10 bg-black/50 shadow-md">
            <img
              src={getImageUrl(val)}
              alt="Gambar Komentar"
              className="w-full h-auto max-h-72 object-contain block"
              loading="lazy"
            />
          </div>
        );
      }
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    elements.push(text.slice(lastIdx));
  }

  return (
    <span key={keyPrefix} className="whitespace-pre-wrap break-words">
      {elements}
    </span>
  );
}

function parseBBCode(text) {
  if (typeof text !== 'string') return text;

  const spoilerRegex = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = spoilerRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(parseFormattedText(text.slice(lastIndex, match.index), `txt-${lastIndex}`));
    }
    const innerContent = match[1];
    parts.push(
      <SpoilerBlock
        key={`spoiler-${match.index}`}
        content={parseFormattedText(innerContent, `sp-inner-${match.index}`)}
      />
    );
    lastIndex = spoilerRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(parseFormattedText(text.slice(lastIndex), `txt-${lastIndex}`));
  }

  return parts.length > 0 ? parts : text;
}

function renderCommentBody(text) {
  if (typeof text !== 'string') return null;

  const stickerPath = parseStickerMessage(text);
  if (stickerPath) {
    return (
      <div className="mt-1">
        <img
          src={getImageUrl(stickerPath)}
          alt="Stiker"
          className="max-h-40 max-w-[min(100%,220px)] rounded-lg object-contain bg-black/30"
          loading="lazy"
        />
      </div>
    );
  }

  return <div className="text-gray-300 text-sm mt-1">{parseBBCode(text)}</div>;
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
    <div className="flex gap-3 py-4 border-b border-white/10 last:border-0">
      {!isVipComment && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-gray-300">
              {(comment.username || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {isVipComment ? (
          <div className="mb-2">
            <div className="relative h-14 md:h-28 overflow-hidden rounded-xl">
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
                      <div className="w-full h-full bg-red-600 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {(comment.username || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm md:text-base truncate">{displayName}</p>
                    <span className="text-[10px] md:text-xs text-gray-200">
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
            <span className="font-bold text-white text-sm">{comment.username}</span>
            <span className="text-xs text-gray-500">
              {comment.created_at ? new Date(comment.created_at).toLocaleString('id-ID') : ''}
            </span>
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-600/80 text-white hover:bg-red-600 disabled:opacity-50"
                aria-label="Hapus komentar"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
              className="mt-2 text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
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
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-100 text-sm placeholder-gray-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyBody.trim() || submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl text-white font-bold text-sm flex items-center gap-1"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            )}
          </>
        )}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 pl-4 border-l-2 border-white/10 space-y-2">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="flex gap-2 py-2">
                {!isVipUser(reply) && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                    {reply.profile_image ? (
                      <img src={getImageUrl(reply.profile_image)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-gray-300">
                        {(reply.username || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-xs">{reply.username}</span>
                    <span className="text-[10px] text-gray-500">
                      {reply.created_at ? new Date(reply.created_at).toLocaleString('id-ID') : ''}
                    </span>
                  </div>
                  {renderCommentBody(reply.body)}
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
  const textareaRef = useRef(null);
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

  const insertBbCode = (openTag, closeTag) => {
    const textarea = textareaRef.current;

    // Direct text insertion if closeTag is empty string
    if (closeTag === '') {
      if (!textarea) {
        setBody((prev) => `${prev}${openTag}`);
        return;
      }
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const newBody = body.slice(0, start) + openTag + body.slice(end);
      setBody(newBody);
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + openTag.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
      return;
    }

    const tagToClose = closeTag !== undefined ? closeTag : openTag;
    if (!textarea) {
      setBody((prev) => `${prev}[${openTag}][/${tagToClose}]`);
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selectedText = body.slice(start, end);
    const replacement = `[${openTag}]${selectedText}[/${tagToClose}]`;
    const newBody = body.slice(0, start) + replacement + body.slice(end);

    setBody(newBody);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + openTag.length + 2 + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleUploadImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);
      const toastId = toast.loading('Mengunggah gambar...');
      
      const res = await apiClient.uploadImage(formData).catch(async () => {
        // Fallback: try uploadBannerImage if generic upload fails
        return await apiClient.uploadBannerImage(formData);
      });

      toast.dismiss(toastId);
      const imgPath = res?.image || res?.url || res?.path;
      if (imgPath) {
        insertBbCode(`img]${imgPath}[/img`, '');
        toast.success('Foto berhasil disisipkan');
      } else {
        toast.error('Gagal mendapatkan URL gambar');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal mengunggah foto');
    }
  };

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
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-md">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
        <MessageCircle className="h-5 w-5 text-red-500" />
        KOMENTAR
      </h3>

      {/* Main Comment Box */}
      <form onSubmit={handleSubmit} className="mb-6">
        {stickerPickerOpen && (
          <div
            ref={stickerTrayRef}
            className="mb-3 rounded-2xl border border-white/10 bg-black/80 p-3 shadow-2xl"
            role="region"
            aria-label="Pilih stiker komentar"
          >
            <p className="px-1 pb-2 text-xs font-bold text-gray-400">Stiker & GIF</p>
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
                      className="aspect-square rounded-xl bg-white/5 border border-white/10 p-1.5 hover:bg-white/10 disabled:opacity-50 transition-colors"
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

        <div className="bg-[#121218] border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all">
          <textarea
            ref={textareaRef}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder={isAuthenticated ? "Silakan ketik komentar Anda..." : "Silakan login untuk bergabung dalam diskusi"}
            disabled={!isAuthenticated || submitting}
            className="w-full bg-transparent p-4 text-gray-100 placeholder-gray-500 focus:outline-none resize-y text-sm font-sans"
          />

          {/* Bottom Control Bar matching User Design */}
          <div className="bg-[#191922] border-t border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 text-gray-400">
              <button
                type="button"
                onClick={() => insertBbCode('b')}
                disabled={!isAuthenticated || submitting}
                className="px-2 py-1 text-sm font-black hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                title="Tebal (Bold)"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertBbCode('i')}
                disabled={!isAuthenticated || submitting}
                className="px-2 py-1 text-sm italic font-serif hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                title="Cetak Miring (Italic)"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertBbCode('s')}
                disabled={!isAuthenticated || submitting}
                className="px-2 py-1 text-sm line-through hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                title="Coretan (Strikethrough)"
              >
                S
              </button>
              <button
                type="button"
                onClick={() => insertBbCode('spoiler')}
                disabled={!isAuthenticated || submitting}
                className="p-1.5 hover:text-red-400 hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                title="Sembunyikan Spoiler"
              >
                <Eye className="h-4 w-4" />
              </button>

              <div className="h-4 w-[1px] bg-white/20 mx-1" />

              {/* Upload Image */}
              <label
                htmlFor="comment-img-upload"
                className={`p-1.5 hover:text-sky-400 hover:bg-white/10 rounded transition-colors ${
                  !isAuthenticated || submitting ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                }`}
                title="Unggah Foto"
              >
                <ImageIcon className="h-4 w-4" />
              </label>
              <input
                type="file"
                id="comment-img-upload"
                accept="image/*"
                disabled={!isAuthenticated || submitting}
                className="hidden"
                onChange={handleUploadImageFile}
              />

              {/* GIF / Sticker Picker */}
              <button
                ref={stickerToggleRef}
                type="button"
                onClick={() => setStickerPickerOpen((open) => !open)}
                disabled={!isAuthenticated || submitting}
                className="p-1.5 hover:text-amber-400 hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                title="Stiker & GIF"
              >
                <Film className="h-4 w-4" />
              </button>
            </div>

            {/* Counter & Submit Button */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500">
                {body.length}/1000
              </span>

              <button
                type="submit"
                disabled={!body.trim() || submitting || !isAuthenticated}
                className="px-5 py-2 bg-[#7e3844] hover:bg-red-600 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                KIRIM
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comment List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
          <p className="text-gray-400 text-sm">Belum ada komentar. Jadi yang pertama berkomentar!</p>
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
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="px-5 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 border border-white/10"
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
