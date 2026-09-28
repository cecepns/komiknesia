import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, getImageUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { timeAgo } from '../utils/timeAgo';

const { width } = Dimensions.get('window');

function getInitials(name, username) {
  const source = String(name || username || 'U').trim();
  if (!source) return 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#0EA5E9',
  '#8B5CF6',
  '#EC4899',
  '#10B981',
  '#F59E0B',
  '#6366F1',
];

function getAvatarColor(name) {
  const seed = String(name || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[seed % AVATAR_COLORS.length];
}

const STICKER_MESSAGE_PREFIX = 'KN_STICKER:';

function parseStickerMessage(text) {
  if (typeof text !== 'string' || !text.startsWith(STICKER_MESSAGE_PREFIX)) return null;
  const path = text.slice(STICKER_MESSAGE_PREFIX.length).trim();
  return path || null;
}

function cleanMessageText(text) {
  if (typeof text !== 'string') return '';
  if (text.startsWith(STICKER_MESSAGE_PREFIX)) return '🖼️ [Stiker]';
  let cleaned = text;
  cleaned = cleaned.replace(/\[\/?spoiler\]/gi, ' ⚠️ [Spoiler] ');
  cleaned = cleaned.replace(/\[?img\][\s\S]*?(?:\[\/?img\]?|$)/gi, ' 📷 [Gambar] ');
  cleaned = cleaned.replace(/\[\/?(b|i|s)\]/gi, '');
  return cleaned.trim();
}

// Resilient Chat Avatar with auto-fallback to colored initials on 404 or image error
const ChatAvatar = ({ profileImage, name, username, isVip, size = 28 }) => {
  const [imgError, setImgError] = useState(false);
  const author = name || username || 'User';
  const avatarUrl = profileImage && !imgError ? getImageUrl(profileImage) : null;

  return (
    <View style={[styles.msgAvatarWrapper, { width: size, height: size }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.msgAvatarImg, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => setImgError(true)}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[
            styles.msgAvatarPlaceholder,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: getAvatarColor(author),
            },
          ]}
        >
          <Text style={[styles.msgAvatarInitial, { fontSize: size > 28 ? 11 : 9.5 }]}>
            {getInitials(name, username)}
          </Text>
        </View>
      )}
      {isVip && (
        <View style={styles.msgVipBadge}>
          <Ionicons name="sparkles" size={6} color="#FFF" />
        </View>
      )}
    </View>
  );
};

// Interactive Spoiler Component for React Native
const ChatSpoilerBlock = ({ children, isMe }) => {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <TouchableOpacity
        style={styles.spoilerHiddenBox}
        activeOpacity={0.8}
        onPress={() => setRevealed(true)}
      >
        <Ionicons name="eye-off-outline" size={13} color="#F87171" />
        <Text style={styles.spoilerHiddenText}>SPOILER (Ketuk untuk melihat)</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.spoilerRevealedBox}
      activeOpacity={0.85}
      onPress={() => setRevealed(false)}
    >
      <View style={styles.spoilerHeaderRow}>
        <Ionicons name="eye-outline" size={12} color="#EF4444" />
        <Text style={styles.spoilerRevealedNotice}>SPOILER (Ketuk untuk tutup)</Text>
      </View>
      <View style={styles.spoilerContentBox}>
        {children}
      </View>
    </TouchableOpacity>
  );
};

// Formatted content parser for rich messages (images, bold, italic, strikethrough)
const renderFormattedInline = (text, keyPrefix, isMe, onImagePress) => {
  if (!text) return null;
  // Robust regex matching [b]...[/b], [i]...[/i], [s]...[/s], and [img]...[/img] or img]...[/img
  const regex = /\[?(img|b|i|s)\]([\s\S]*?)(?:\[?\/\1\]?|(?=\s|$|\[?(?:img|b|i|s)\]))/gi;
  const elements = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      elements.push(
        <Text key={`${keyPrefix}-t-${lastIdx}`} style={[styles.msgBubbleText, isMe && styles.msgBubbleTextMe]}>
          {text.slice(lastIdx, match.index)}
        </Text>
      );
    }
    const tag = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : '';

    if (tag === 'img') {
      val = val.replace(/\[\/?img\]?/gi, '').trim();
      if (val) {
        const fullUrl = getImageUrl(val);
        elements.push(
          <TouchableOpacity
            key={`${keyPrefix}-img-${match.index}`}
            activeOpacity={0.9}
            onPress={() => onImagePress && onImagePress(fullUrl)}
            style={styles.chatImgWrapper}
          >
            <Image
              source={{ uri: fullUrl }}
              style={styles.chatUploadedImg}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        );
      }
    } else if (tag === 'b') {
      elements.push(
        <Text key={`${keyPrefix}-b-${match.index}`} style={[styles.msgBubbleText, styles.textBold, isMe && styles.msgBubbleTextMe]}>
          {val}
        </Text>
      );
    } else if (tag === 'i') {
      elements.push(
        <Text key={`${keyPrefix}-i-${match.index}`} style={[styles.msgBubbleText, styles.textItalic, isMe && styles.msgBubbleTextMe]}>
          {val}
        </Text>
      );
    } else if (tag === 's') {
      elements.push(
        <Text key={`${keyPrefix}-s-${match.index}`} style={[styles.msgBubbleText, styles.textStrike, isMe && styles.msgBubbleTextMe]}>
          {val}
        </Text>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    elements.push(
      <Text key={`${keyPrefix}-t-end`} style={[styles.msgBubbleText, isMe && styles.msgBubbleTextMe]}>
        {text.slice(lastIdx)}
      </Text>
    );
  }

  return elements;
};

// Rich Message Component supporting Stickers, Spoilers, Images, and Text Formatting
const ChatRichMessage = ({ text, isMe, onImagePress }) => {
  if (typeof text !== 'string') return null;

  // 1. Sticker Message
  const stickerPath = parseStickerMessage(text);
  if (stickerPath) {
    const fullUrl = getImageUrl(stickerPath);
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onImagePress && onImagePress(fullUrl)}
        style={styles.chatStickerBox}
      >
        <Image
          source={{ uri: fullUrl }}
          style={styles.chatStickerImg}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  }

  // 2. Spoiler Message
  const spoilerRegex = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi;
  if (spoilerRegex.test(text)) {
    const parts = [];
    let lastIdx = 0;
    let match;
    const regex = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(
          <View key={`pre-${lastIdx}`} style={styles.flowRow}>
            {renderFormattedInline(text.slice(lastIdx, match.index), `pre-${lastIdx}`, isMe, onImagePress)}
          </View>
        );
      }
      const inner = match[1];
      parts.push(
        <ChatSpoilerBlock key={`sp-${match.index}`} isMe={isMe}>
          <View style={styles.flowRow}>
            {renderFormattedInline(inner, `sp-in-${match.index}`, isMe, onImagePress)}
          </View>
        </ChatSpoilerBlock>
      );
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(
        <View key={`post-${lastIdx}`} style={styles.flowRow}>
          {renderFormattedInline(text.slice(lastIdx), `post-${lastIdx}`, isMe, onImagePress)}
        </View>
      );
    }

    return <View style={styles.richMsgCol}>{parts}</View>;
  }

  // 3. Regular Formatted Message
  return (
    <View style={styles.richMsgCol}>
      <View style={styles.flowRow}>
        {renderFormattedInline(text, 'norm', isMe, onImagePress)}
      </View>
    </View>
  );
};

export const ChatroomCard = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInputText, setModalInputText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const modalScrollRef = useRef(null);

  // Keyboard avoidance listeners for Android & iOS
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const rawHeight = e?.endCoordinates?.height || 0;
      let effectiveHeight = rawHeight;

      if (Platform.OS === 'android') {
        const screenHeight = Dimensions.get('screen').height;
        const windowHeight = Dimensions.get('window').height;
        // On Android devices with navigation bars (3 buttons or gesture), the modal with statusBarTranslucent
        // extends behind the navigation bar. The keyboard opens above the navigation bar, so the modal offset
        // from screen bottom must include the navigation bar height (~48-56dp).
        const navBarDiff = Math.max(0, screenHeight - windowHeight);
        const navBarHeight = Math.max(insets.bottom || 0, navBarDiff, 48);

        const fromScreenY = (e?.endCoordinates?.screenY && e.endCoordinates.screenY < screenHeight)
          ? (screenHeight - e.endCoordinates.screenY)
          : 0;

        effectiveHeight = Math.max(rawHeight + navBarHeight, fromScreenY + 20, rawHeight);
      }

      setKeyboardHeight(effectiveHeight);
      setKeyboardVisible(true);
      setTimeout(() => {
        modalScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const fetchChats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.getLiveChats({ limit: 50 });
      if (res?.status && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
    // Auto-refresh chat every 15 seconds
    const interval = setInterval(() => {
      fetchChats(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  // Load stickers on demand
  const fetchStickers = async () => {
    if (stickers.length > 0) return;
    setStickersLoading(true);
    try {
      const res = await apiClient.getStickers({ page: 1, limit: 50 });
      let items = [];
      if (Array.isArray(res?.data)) items = res.data;
      else if (res?.data?.items && Array.isArray(res.data.items)) items = res.data.items;
      setStickers(items);
    } catch {
      // ignore
    } finally {
      setStickersLoading(false);
    }
  };

  const handleToggleStickers = () => {
    Keyboard.dismiss();
    setStickerPickerOpen((prev) => {
      const next = !prev;
      if (next) fetchStickers();
      return next;
    });
  };

  const handleSelectSticker = async (stickerPath) => {
    setStickerPickerOpen(false);
    await handleSendMessage(`KN_STICKER:${stickerPath}`, true);
  };

  // Upload image to chat
  const handlePickImage = async () => {
    if (uploadingImage) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Akses Galeri',
          'Aplikasi membutuhkan izin akses galeri untuk mengunggah foto ke chatroom.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setUploadingImage(true);

      const formData = new FormData();
      const filename = asset.fileName || asset.uri.split('/').pop() || `chat_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const mime = match ? `image/${match[1].toLowerCase()}` : (asset.mimeType || 'image/jpeg');

      formData.append('image', {
        uri: asset.uri,
        name: filename,
        type: mime,
      });

      const res = await apiClient.uploadImage(formData);
      const imgPath = res?.image || res?.url || res?.path;

      if (imgPath) {
        setModalInputText((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} [img]${imgPath}[/img]` : `[img]${imgPath}[/img]`;
        });
      } else {
        Alert.alert('Gagal Mengunggah', 'Tidak dapat memperoleh tautan gambar.');
      }
    } catch (err) {
      console.warn('Image upload error:', err);
      Alert.alert('Gagal', err.message || 'Gagal mengunggah foto ke chat.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleInsertTag = (tag) => {
    setModalInputText((prev) => `${prev}[${tag}]teks[/${tag}]`);
  };

  const handleInsertSpoiler = () => {
    setModalInputText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} [spoiler]teks spoiler[/spoiler]` : `[spoiler]teks spoiler[/spoiler]`;
    });
  };

  const handleSendMessage = async (textToSend, isFromModal = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    if (!isAuthenticated) {
      if (isFromModal) setModalVisible(false);
      navigation.navigate('Login');
      return;
    }

    setSending(true);
    if (isFromModal) {
      setModalInputText('');
      setStickerPickerOpen(false);
    } else {
      setInputText('');
    }

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      name: user?.name || user?.username || 'Saya',
      username: user?.username || 'user',
      profile_image: user?.avatar || null,
      message: trimmed,
      created_at: new Date().toISOString(),
      membership_active: user?.membership_active || false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      modalScrollRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      const res = await apiClient.postLiveChat(trimmed);
      if (res?.status && res.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data : m))
        );
      }
      fetchChats(true);
    } catch (err) {
      console.warn('Chat send error:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert('Gagal Mengirim', err.message || 'Gagal mengirim pesan chat.');
    } finally {
      setSending(false);
    }
  };

  // 3 latest messages for card preview
  const previewMessages = messages.slice(-3);

  return (
    <View style={styles.cardContainer}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="chatbubbles" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.headerTextCol}>
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={styles.cardTitle}>
                Chatroom Komunitas
              </Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cardSubtitle}>
              Ngobrol seru bareng pembaca KomikNesia
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.openModalBtn}
          activeOpacity={0.75}
          onPress={() => {
            setModalVisible(true);
            setTimeout(() => {
              modalScrollRef.current?.scrollToEnd({ animated: false });
            }, 100);
          }}
        >
          <Text style={styles.openModalBtnText}>Buka Chat</Text>
          <Ionicons name="arrow-forward" size={13} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Messages Preview Container */}
      <View style={styles.messagesBox}>
        {loading && messages.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Memuat obrolan...</Text>
          </View>
        ) : previewMessages.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Belum ada pesan. Mulai obrolan pertama!</Text>
          </View>
        ) : (
          previewMessages.map((msg, idx) => {
            const author = msg.name || msg.username || 'User';
            const isVip = !!msg.membership_active || msg.role === 'vip';
            const cleanText = cleanMessageText(msg.message);

            return (
              <View key={msg.id || `msg-${idx}`} style={styles.messageRow}>
                <ChatAvatar
                  profileImage={msg.profile_image}
                  name={msg.name}
                  username={msg.username}
                  isVip={isVip}
                  size={28}
                />

                <View style={styles.msgContentBox}>
                  <View style={styles.msgMetaRow}>
                    <Text numberOfLines={1} style={styles.msgAuthorName}>
                      {author}
                    </Text>
                    {isVip && (
                      <View style={styles.msgVipTag}>
                        <Text style={styles.msgVipTagText}>VIP</Text>
                      </View>
                    )}
                    <Text style={styles.msgTimeText}>
                      {timeAgo(msg.created_at)}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={styles.msgBubbleText}>
                    {cleanText}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Card Input / Auth Prompt Footer */}
      {isAuthenticated ? (
        <View style={styles.cardInputRow}>
          <TextInput
            placeholder="Tulis pesan ke komunitas..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            style={styles.cardTextInput}
            maxLength={250}
          />
          <TouchableOpacity
            style={[styles.cardSendBtn, (!inputText.trim() || sending) && styles.cardSendBtnDisabled]}
            activeOpacity={0.8}
            onPress={() => handleSendMessage(inputText, false)}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={15} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.loginPromptBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
        >
          <Ionicons name="log-in-outline" size={17} color={COLORS.primary} />
          <Text style={styles.loginPromptText}>
            Masuk untuk ikut mengobrol di Chatroom
          </Text>
          <Ionicons name="chevron-forward" size={15} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}

      {/* FULL CHATROOM MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => {
          setStickerPickerOpen(false);
          setModalVisible(false);
        }}
      >
        <View
          style={[
            styles.modalContainer,
            Platform.OS === 'android' && keyboardHeight > 0
              ? { paddingBottom: keyboardHeight }
              : null,
          ]}
        >
          {/* Modal Header */}
          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: Math.max(
                  insets.top,
                  Platform.OS === 'ios' ? 44 : SPACING.md
                ),
              },
            ]}
          >
            <View style={styles.modalHeaderLeft}>
              <TouchableOpacity
                onPress={() => {
                  setStickerPickerOpen(false);
                  setModalVisible(false);
                }}
                style={styles.modalBackBtn}
              >
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.modalHeaderTitle}>Chatroom Komunitas</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
                <Text style={styles.modalHeaderSubtitle}>
                  {messages.length} pesan terbaru
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => fetchChats(false)}
              style={styles.modalRefreshBtn}
            >
              <Ionicons name="refresh" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Modal Messages Scroll */}
          <ScrollView
            ref={modalScrollRef}
            style={styles.modalMessageList}
            contentContainerStyle={styles.modalMessageContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              modalScrollRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {messages.map((msg, idx) => {
              const author = msg.name || msg.username || 'User';
              const isVip = !!msg.membership_active || msg.role === 'vip';
              const isMe = isAuthenticated && (user?.username === msg.username || user?.name === msg.name);

              return (
                <View
                  key={msg.id || `full-msg-${idx}`}
                  style={[styles.modalMsgRow, isMe && styles.modalMsgRowMe]}
                >
                  {!isMe && (
                    <ChatAvatar
                      profileImage={msg.profile_image}
                      name={msg.name}
                      username={msg.username}
                      isVip={isVip}
                      size={32}
                    />
                  )}

                  <View
                    style={[
                      styles.modalMsgBubble,
                      isMe ? styles.modalMsgBubbleMe : styles.modalMsgBubbleOther,
                    ]}
                  >
                    <View style={styles.msgMetaRow}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.msgAuthorName,
                          isMe && { color: '#FEE2E2' },
                        ]}
                      >
                        {isMe ? 'Kamu' : author}
                      </Text>
                      {isVip && (
                        <View style={styles.msgVipTag}>
                          <Text style={styles.msgVipTagText}>VIP</Text>
                        </View>
                      )}
                      <Text style={styles.msgTimeText}>
                        {timeAgo(msg.created_at)}
                      </Text>
                    </View>

                    {/* Rich Message Body (Spoilers, Images, BBCode, Stickers) */}
                    <ChatRichMessage
                      text={msg.message}
                      isMe={isMe}
                      onImagePress={(url) => setPreviewImageUrl(url)}
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Sticker Tray Panel */}
          {stickerPickerOpen && (
            <View style={styles.stickerTray}>
              <View style={styles.stickerTrayHeader}>
                <Text style={styles.stickerTrayTitle}>Pilih Stiker KomikNesia</Text>
                <TouchableOpacity onPress={() => setStickerPickerOpen(false)}>
                  <Ionicons name="close" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {stickersLoading ? (
                <View style={styles.stickerLoadingBox}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.stickerLoadingText}>Memuat stiker...</Text>
                </View>
              ) : stickers.length === 0 ? (
                <View style={styles.stickerEmptyBox}>
                  <Text style={styles.stickerEmptyText}>Belum ada stiker tersedia.</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.stickerScrollList}
                >
                  {stickers.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.stickerPickerItem}
                      activeOpacity={0.7}
                      onPress={() => handleSelectSticker(s.image_path)}
                    >
                      <Image
                        source={{ uri: getImageUrl(s.image_path) }}
                        style={styles.stickerThumb}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Modal Bottom Area with KeyboardAvoidingView */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {isAuthenticated ? (
              <View
                style={[
                  styles.modalBottomBox,
                  {
                    paddingBottom: keyboardVisible
                      ? (Platform.OS === 'ios' ? SPACING.xs : SPACING.sm)
                      : Math.max(
                          insets.bottom || 0,
                          (Dimensions.get('screen').height - Dimensions.get('window').height) || 0,
                          Platform.OS === 'ios' ? 24 : 16
                        ) + 6,
                  },
                ]}
              >
                {/* BBCode & Media Toolbar (Spoiler, Gambar, Bold, Italic, Stiker) */}
                <View style={styles.toolbarRow}>
                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => handleInsertTag('b')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toolBtnTextBold}>B</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => handleInsertTag('i')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toolBtnTextItalic}>I</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => handleInsertTag('s')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toolBtnTextStrike}>S</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toolBtn, styles.toolBtnSpoiler]}
                    onPress={handleInsertSpoiler}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="eye-off-outline" size={13} color="#F87171" />
                    <Text style={styles.toolBtnSpoilerText}>Spoiler</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toolBtn, styles.toolBtnImage]}
                    onPress={handlePickImage}
                    disabled={uploadingImage}
                    activeOpacity={0.7}
                  >
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color="#60A5FA" />
                    ) : (
                      <Ionicons name="image-outline" size={14} color="#60A5FA" />
                    )}
                    <Text style={styles.toolBtnImageText}>
                      {uploadingImage ? 'Upload...' : 'Gambar'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toolBtn, styles.toolBtnSticker, stickerPickerOpen && styles.toolBtnActive]}
                    onPress={handleToggleStickers}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={stickerPickerOpen ? 'close-circle' : 'happy-outline'}
                      size={14}
                      color={stickerPickerOpen ? '#EF4444' : '#F59E0B'}
                    />
                    <Text style={[styles.toolBtnText, stickerPickerOpen && { color: '#EF4444' }]}>
                      Stiker
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Input & Send Button */}
                <View style={styles.inputSendRow}>
                  <TextInput
                    placeholder="Ketik pesan chat..."
                    placeholderTextColor={COLORS.textMuted}
                    value={modalInputText}
                    onChangeText={setModalInputText}
                    style={styles.modalTextInput}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity
                    style={[
                      styles.modalSendBtn,
                      (!modalInputText.trim() || sending) && styles.cardSendBtnDisabled,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleSendMessage(modalInputText, true)}
                    disabled={!modalInputText.trim() || sending}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="send" size={17} color="#FFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.modalLoginBar,
                  {
                    paddingBottom: Math.max(insets.bottom, SPACING.md),
                  },
                ]}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('Login');
                }}
              >
                <Text style={styles.modalLoginText}>
                  Masuk untuk mengirim pesan di chatroom
                </Text>
              </TouchableOpacity>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Fullscreen Image Preview Lightbox */}
      {previewImageUrl && (
        <Modal
          visible={!!previewImageUrl}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImageUrl(null)}
        >
          <View style={styles.imageLightboxOverlay}>
            <TouchableOpacity
              style={styles.imageLightboxCloseBtn}
              onPress={() => setPreviewImageUrl(null)}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.imageLightboxImg}
              contentFit="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    backgroundColor: '#111522',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    flexShrink: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  cardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    flexShrink: 0,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#10B981',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  openModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  openModalBtnText: {
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  messagesBox: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 11.5,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  msgAvatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  msgAvatarImg: {
    backgroundColor: '#1F2937',
  },
  msgAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgAvatarInitial: {
    color: '#FFF',
    fontWeight: '800',
  },
  msgVipBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  msgContentBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  msgAuthorName: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  msgVipTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  msgVipTagText: {
    color: '#F59E0B',
    fontSize: 8,
    fontWeight: '900',
  },
  msgTimeText: {
    color: '#6B7280',
    fontSize: 9.5,
    marginLeft: 'auto',
  },
  msgBubbleText: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 16.5,
  },
  msgBubbleTextMe: {
    color: '#FFF',
  },
  cardInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardTextInput: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: '#FFF',
    fontSize: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  cardSendBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSendBtnDisabled: {
    opacity: 0.45,
  },
  loginPromptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(220, 38, 38, 0.15)',
  },
  loginPromptText: {
    flex: 1,
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
  },

  // MODAL STYLES
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: '#111522',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalHeaderSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  modalRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMessageList: {
    flex: 1,
  },
  modalMessageContent: {
    padding: SPACING.md,
    gap: 12,
  },
  modalMsgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalMsgRowMe: {
    justifyContent: 'flex-end',
  },
  modalMsgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
  },
  modalMsgBubbleOther: {
    backgroundColor: '#161C2C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  modalMsgBubbleMe: {
    backgroundColor: COLORS.primary,
  },

  // RICH FORMATTING & SPOILER STYLES
  richMsgCol: {
    marginTop: 2,
    gap: 4,
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  textBold: {
    fontWeight: '900',
  },
  textItalic: {
    fontStyle: 'italic',
  },
  textStrike: {
    textDecorationLine: 'line-through',
  },
  spoilerHiddenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(127, 29, 29, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  spoilerHiddenText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  spoilerRevealedBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 3.5,
    borderLeftColor: '#EF4444',
    borderRadius: RADIUS.md,
    padding: 8,
    marginVertical: 4,
    minWidth: 140,
  },
  spoilerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  spoilerRevealedNotice: {
    color: '#F87171',
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  spoilerContentBox: {
    marginTop: 2,
  },
  chatImgWrapper: {
    marginVertical: 4,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  chatUploadedImg: {
    width: width * 0.52,
    height: width * 0.42,
    borderRadius: RADIUS.lg,
  },
  chatStickerBox: {
    marginVertical: 2,
  },
  chatStickerImg: {
    width: 90,
    height: 90,
  },

  // STICKER TRAY
  stickerTray: {
    backgroundColor: '#111522',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
  },
  stickerTrayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: 6,
  },
  stickerTrayTitle: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  stickerLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  stickerLoadingText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  stickerEmptyBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  stickerEmptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  stickerScrollList: {
    paddingHorizontal: SPACING.md,
    gap: 10,
  },
  stickerPickerItem: {
    width: 62,
    height: 62,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stickerThumb: {
    width: 50,
    height: 50,
  },

  // MODAL BOTTOM & TOOLBAR
  modalBottomBox: {
    backgroundColor: '#111522',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
  },
  toolBtnSpoiler: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
  },
  toolBtnSpoilerText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  toolBtnImage: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1,
  },
  toolBtnImageText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
  toolBtnSticker: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  toolBtnText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '600',
  },
  toolBtnTextBold: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  toolBtnTextItalic: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  toolBtnTextStrike: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  inputSendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: 6,
  },
  modalTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    paddingBottom: 10,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalSendBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoginBar: {
    padding: SPACING.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoginText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // LIGHTBOX MODAL
  imageLightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageLightboxImg: {
    width: width * 0.95,
    height: width * 1.2,
  },
});
