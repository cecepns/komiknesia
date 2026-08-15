import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, Smile, X, Eye, EyeOff, Image as ImageIcon, Film } from "lucide-react";
import { io } from "socket.io-client";
import { API_BASE_URL_WITHOUT_API, apiClient, getImageUrl } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { useScrollHide } from "../hooks/useScrollHide";
import vipProfileBanner from "../assets/gif/banner-vip.gif";
import { toast } from "react-toastify";

function getInitials(name, username) {
  const source = String(name || username || "U").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function avatarSeed(name) {
  const colors = [
    "bg-cyan-500",
    "bg-fuchsia-500",
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
  ];
  const seed = String(name || "")
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[seed % colors.length];
}

/** Waktu lokal: "11 Apr 2026 18:02" (bukan hanya jam — supaya beda hari tetap jelas). */
function formatChatDateTime(value) {
  if (value == null || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year} ${h}:${min}`;
}

/** Prefix pesan stiker/gambar (path relatif uploads); tetap di bawah batas panjang chat. */
const STICKER_MESSAGE_PREFIX = "KN_STICKER:";

function parseStickerMessage(text) {
  if (typeof text !== "string" || !text.startsWith(STICKER_MESSAGE_PREFIX)) return null;
  const path = text.slice(STICKER_MESSAGE_PREFIX.length).trim();
  return path || null;
}

/** API lama: `data: []` — API baru: `data: { items: [] }`. */
function stickersFromApiResponse(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  return [];
}

function isTruthyLike(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "active";
  }
  return false;
}

function isVipUser(message) {
  const role = String(message?.role || "").trim().toLowerCase();
  if (role === "vip" || role === "premium") return true;
  if (isTruthyLike(message?.membership_active)) return true;
  if (!isTruthyLike(message?.is_membership)) return false;
  if (!message?.membership_expires_at) return true;
  const expiresAt = new Date(message.membership_expires_at);
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
        className="my-1.5 inline-flex items-center gap-1.5 rounded-xl bg-red-950/80 border border-red-700/60 px-2.5 py-1 text-xs font-bold text-red-300 hover:bg-red-900 transition-colors cursor-pointer select-none shadow-md"
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
      className="my-1.5 block rounded-xl bg-white/[0.05] border-l-4 border-red-500 p-2.5 text-xs sm:text-sm text-gray-200 cursor-pointer hover:bg-white/[0.08] transition-colors"
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

  const regex = /\[(img|b|i|s)\]([\s\S]*?)\[\/\1\]/gi;
  const elements = [];
  let lastIdx = 0;
  let m;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      elements.push(text.slice(lastIdx, m.index));
    }
    const tag = m[1].toLowerCase();
    const val = m[2];
    const key = `${keyPrefix}-${m.index}`;

    if (tag === 'b') {
      elements.push(<strong key={key} className="font-bold text-white">{val}</strong>);
    } else if (tag === 'i') {
      elements.push(<em key={key} className="italic">{val}</em>);
    } else if (tag === 's') {
      elements.push(<del key={key} className="line-through text-gray-400">{val}</del>);
    } else if (tag === 'img') {
      elements.push(
        <div key={key} className="my-1.5 max-w-xs rounded-xl overflow-hidden border border-white/10 bg-black/50 shadow-md">
          <img
            src={getImageUrl(val.trim())}
            alt="Gambar Chat"
            className="w-full h-auto max-h-60 object-contain block"
            loading="lazy"
          />
        </div>
      );
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

function renderChatMessageBody(text) {
  const imagePath = parseStickerMessage(text);
  if (imagePath) {
    const src = getImageUrl(imagePath);
    return (
      <div className="mt-1">
        <img
          src={src}
          alt="Stiker"
          className="max-h-36 max-w-[min(100%,220px)] rounded-lg object-contain bg-black/30"
          loading="lazy"
        />
      </div>
    );
  }
  return <div className="mt-1 text-gray-300 text-xs sm:text-sm">{parseBBCode(text)}</div>;
}

const LiveChatWidget = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [brokenAvatarIds, setBrokenAvatarIds] = useState(() => new Set());
  const chatListRef = useRef(null);
  const textareaRef = useRef(null);
  const socketRef = useRef(null);
  const stickerToggleRef = useRef(null);
  const stickerTrayRef = useRef(null);
  const { user } = useAuth();

  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [stickersError, setStickersError] = useState("");

  const insertBbCode = (openTag, closeTag = openTag) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setChatInput((prev) => `${prev}[${openTag}][/${closeTag}]`);
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selectedText = chatInput.slice(start, end);
    const replacement = `[${openTag}]${selectedText}[/${closeTag}]`;
    const newChatInput = chatInput.slice(0, start) + replacement + chatInput.slice(end);

    setChatInput(newChatInput);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + openTag.length + 2 + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleUploadImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imgUrl = ev.target.result;
        insertBbCode(`img]${imgUrl}[/img`, '');
        toast.success('Foto disisipkan');
      } catch {
        toast.error('Foto terlalu besar');
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!chatOpen) setStickerPickerOpen(false);
  }, [chatOpen]);

  const loadLiveChats = async ({ silent = false } = {}) => {
    if (!silent) setChatLoading(true);
    try {
      const res = await apiClient.getLiveChats({ limit: 100 });
      setChatMessages(Array.isArray(res?.data) ? res.data : []);
      setChatError("");
    } catch (error) {
      setChatError(error?.message || "Gagal memuat live chat");
    } finally {
      if (!silent) setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!chatOpen) return undefined;

    loadLiveChats();
    const socket = io(API_BASE_URL_WITHOUT_API || window.location.origin, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("live-chat:new-message", (message) => {
      if (!message || !message.id) return;
      setChatMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        const next = [...prev, message];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    });

    socket.on("connect_error", () => {
      setChatError("Koneksi live chat terputus");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [chatOpen]);

  useEffect(() => {
    if (!stickerPickerOpen || !chatOpen) return undefined;

    const load = async () => {
      setStickersLoading(true);
      setStickersError("");
      try {
        const res = await apiClient.getStickers({ page: 1, limit: 50 });
        setStickers(stickersFromApiResponse(res));
      } catch (err) {
        setStickersError(err?.message || "Gagal memuat stiker");
        setStickers([]);
      } finally {
        setStickersLoading(false);
      }
    };
    load();
  }, [stickerPickerOpen, chatOpen]);

  useEffect(() => {
    if (!stickerPickerOpen) return undefined;
    const onPointerDown = (e) => {
      if (stickerToggleRef.current?.contains(e.target)) return;
      if (stickerTrayRef.current?.contains(e.target)) return;
      setStickerPickerOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [stickerPickerOpen]);

  useEffect(() => {
    if (!chatOpen || !chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages, chatOpen]);

  const sendChatMessage = useCallback(
    async (rawMessage) => {
      const message = String(rawMessage || "").trim();
      if (!message || !user || chatSending) return;

      if (message.length > 3000) {
        setChatError("Pesan terlalu panjang (maksimal 3000 karakter)");
        return;
      }

      try {
        setChatSending(true);
        const token = apiClient.getAuthToken();
        const socket = socketRef.current;
        if (socket && socket.connected && token) {
          await new Promise((resolve, reject) => {
            socket.emit("live-chat:send", { message, token }, (response) => {
              if (response?.status) {
                resolve();
                return;
              }
              reject(new Error(response?.error || "Gagal mengirim pesan"));
            });
          });
        } else {
          await apiClient.postLiveChat(message);
        }
        setChatError("");
      } catch (error) {
        setChatError(error?.message || "Gagal mengirim pesan");
      } finally {
        setChatSending(false);
      }
    },
    [user, chatSending]
  );

  const handleSubmitChat = async (e) => {
    e.preventDefault();
    const message = chatInput.trim();
    if (!message) return;
    await sendChatMessage(message);
    setChatInput("");
  };

  const handlePickSticker = async (imagePath) => {
    const path = String(imagePath || "").trim();
    if (!path) return;
    const message = `${STICKER_MESSAGE_PREFIX}${path}`;
    setStickerPickerOpen(false);
    await sendChatMessage(message);
  };

  const markAvatarBroken = (id) => {
    if (!id) return;
    setBrokenAvatarIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed right-4 z-[70] bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-5 md:right-5"
    >
      <div
        className={`absolute bottom-[72px] right-0 w-[min(92vw,380px)] rounded-2xl border border-white/20 bg-gray-950/95 text-white shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-300 ${
          chatOpen
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        }`}
        role="dialog"
        aria-modal="false"
        aria-label="Live chat komunitas"
      >
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold text-lg">CHAT</h3>
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Tutup live chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={chatListRef} className="max-h-[360px] overflow-y-auto px-4 py-2 space-y-3">
          {chatLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Memuat chat...</div>
          ) : chatMessages.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">Belum ada chat.</div>
          ) : (
            chatMessages.map((msg) => {
              const label = msg.name || msg.username || "User";
              const hasImage = msg.profile_image && !brokenAvatarIds.has(msg.id);
              const vipUser = isVipUser(msg);
              return (
                <div key={msg.id} className="pb-3 border-b border-white/5 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    {vipUser ? (
                      <div className="mb-2">
                        <div className="mb-1.5 flex justify-end">
                          <span className="text-[10px] sm:text-xs text-gray-300 tabular-nums">
                            {formatChatDateTime(msg.created_at)}
                          </span>
                        </div>
                        <div className="relative h-16 overflow-hidden rounded-xl">
                          <img
                            src={vipProfileBanner}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center gap-2.5 px-3">
                            <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 bg-white">
                              {hasImage ? (
                                <img
                                  src={getImageUrl(msg.profile_image)}
                                  alt={label}
                                  className="h-full w-full object-cover"
                                  onError={() => markAvatarBroken(msg.id)}
                                />
                              ) : (
                                <div
                                  className={`h-full w-full ${avatarSeed(label)} flex items-center justify-center text-sm font-bold text-white`}
                                >
                                  {getInitials(msg.name, msg.username)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white drop-shadow-sm">
                                {label}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 pl-1">
                        <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
                          {hasImage ? (
                            <img
                              src={getImageUrl(msg.profile_image)}
                              alt={label}
                              className="h-full w-full object-cover"
                              onError={() => markAvatarBroken(msg.id)}
                            />
                          ) : (
                            <div
                              className={`h-full w-full ${avatarSeed(label)} flex items-center justify-center text-xs font-bold`}
                            >
                              {getInitials(msg.name, msg.username)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-sm truncate">{label}</p>
                            <span className="text-[10px] sm:text-xs text-gray-400 shrink-0 tabular-nums text-right max-w-[7.5rem] sm:max-w-none leading-tight">
                              {formatChatDateTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {renderChatMessageBody(msg.message)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {chatError && <p className="px-4 py-2 text-xs text-red-400">{chatError}</p>}

        {user ? (
          <form onSubmit={handleSubmitChat} className="px-3 py-3 border-t border-white/10 space-y-2">
            {stickerPickerOpen && (
              <div
                ref={stickerTrayRef}
                className="rounded-2xl border border-white/15 bg-black/50 p-2"
                role="region"
                aria-label="Pilih stiker"
              >
                <p className="px-2 pt-0.5 pb-2 text-xs font-semibold text-gray-400">Stiker</p>
                <div className="max-h-44 overflow-y-auto px-1">
                  {stickersLoading ? (
                    <div className="py-6 text-center text-xs text-gray-500">Memuat stiker…</div>
                  ) : stickersError ? (
                    <div className="py-4 px-2 text-center text-xs text-red-400">{stickersError}</div>
                  ) : stickers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-500">Belum ada stiker.</div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {stickers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={chatSending}
                          onClick={() => handlePickSticker(s.image_path)}
                          title={s.name || "Stiker"}
                          className="aspect-square rounded-xl bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-50 transition-colors border border-white/5"
                        >
                          <img
                            src={getImageUrl(s.image_path)}
                            alt={s.name || ""}
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

            {/* BBCode formatting toolbar */}
            <div className="flex items-center gap-1 pb-1 border-b border-white/10">
              <button
                type="button"
                onClick={() => insertBbCode('b')}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-xs font-bold text-gray-300"
                title="Teks Tebal [b]"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertBbCode('i')}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-xs italic font-serif text-gray-300"
                title="Teks Miring [i]"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertBbCode('s')}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-xs line-through text-gray-300"
                title="Coret [s]"
              >
                S
              </button>
              <button
                type="button"
                onClick={() => insertBbCode('spoiler')}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-semibold text-red-400 flex items-center gap-1"
                title="Tambah Spoiler [spoiler]"
              >
                <Eye className="h-3 w-3" /> Spoiler
              </button>
              <label className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-semibold text-gray-300 cursor-pointer flex items-center gap-1">
                <ImageIcon className="h-3 w-3 text-blue-400" /> Gambar
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImageFile}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={3}
              placeholder="Tulis pesan..."
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-y min-h-[4.5rem]"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                ref={stickerToggleRef}
                type="button"
                onClick={() => setStickerPickerOpen((o) => !o)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                aria-label={stickerPickerOpen ? "Tutup panel stiker" : "Buka stiker"}
                aria-expanded={stickerPickerOpen}
              >
                <Smile className="h-5 w-5" strokeWidth={2} />
              </button>
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
                {chatSending ? "Mengirim..." : "Kirim"}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-4 py-3 border-t border-white/10 text-sm text-gray-300 flex items-center justify-between gap-3">
            <span>Login dulu untuk kirim chat.</span>
            <Link
              to="/akun"
              className="inline-flex items-center justify-center rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
            >
              Masuk
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end">
        {!chatOpen && (
          <div className="mb-2 rounded-full border border-white/15 bg-gray-950/95 px-3 py-1 text-xs font-semibold text-gray-200 shadow-lg backdrop-blur-sm">
            Chat Room
          </div>
        )}
        <button
          type="button"
          onClick={() => setChatOpen((prev) => !prev)}
          aria-label={chatOpen ? "Tutup live chat" : "Buka live chat"}
          className={`relative h-14 w-14 rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-[0_12px_35px_rgba(225,29,72,0.45)] transition-all duration-300 hover:scale-110 active:scale-95 ${
            chatOpen ? "rotate-180" : ""
          }`}
        >
          <span className="relative z-10 flex items-center justify-center">
            {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </span>
        </button>
      </div>
    </div>
  );
};

export default LiveChatWidget;

