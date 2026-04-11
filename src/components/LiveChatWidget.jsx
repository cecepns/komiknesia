import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, X } from "lucide-react";
import { io } from "socket.io-client";
import { API_BASE_URL_WITHOUT_API, apiClient, getImageUrl } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

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

const LiveChatWidget = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [brokenAvatarIds, setBrokenAvatarIds] = useState(() => new Set());
  const chatListRef = useRef(null);
  const socketRef = useRef(null);
  const { user } = useAuth();

  const chatWordCount = useMemo(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [chatInput]);

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
    if (!chatOpen || !chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages, chatOpen]);

  const handleSubmitChat = async (e) => {
    e.preventDefault();
    if (!user || chatSending) return;

    const message = chatInput.trim();
    if (!message) return;

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
      setChatInput("");
      setChatError("");
    } catch (error) {
      setChatError(error?.message || "Gagal mengirim pesan");
    } finally {
      setChatSending(false);
    }
  };

  const formatChatTime = (value) => {
    try {
      return new Date(value).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
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
    <div className="fixed bottom-24 right-4 md:bottom-5 md:right-5 z-[70]">
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
              return (
                <div key={msg.id} className="pb-3 border-b border-white/5 last:border-b-0">
                  <div className="flex items-start gap-3">
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
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatChatTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-gray-300 break-words">{msg.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {chatError && <p className="px-4 py-2 text-xs text-red-400">{chatError}</p>}

        {user ? (
          <form onSubmit={handleSubmitChat} className="px-3 py-3 border-t border-white/10">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Tulis Pesan disini"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs ${chatWordCount > 100 ? "text-red-400" : "text-gray-400"}`}>
                {chatWordCount} kata
              </span>
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  );
};

export default LiveChatWidget;

