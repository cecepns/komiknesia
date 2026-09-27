import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

function cleanMessageText(text) {
  if (typeof text !== 'string') return '';
  if (text.startsWith('KN_STICKER:')) return '🖼️ [Stiker]';
  return text.replace(/\[\/?spoiler\]/gi, '⚠️ ');
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
  const modalScrollRef = useRef(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const fetchChats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.getLiveChats({ limit: 40 });
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

    try {
      const res = await apiClient.postLiveChat(trimmed);
      if (res?.status && res.data) {
        // Replace temp with real response if provided
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data : m))
        );
      }
      fetchChats(true);
    } catch (err) {
      console.warn('Chat send error:', err);
      // Revert optimistic msg on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
                {/* Avatar with auto-fallback to colored initials */}
                <ChatAvatar
                  profileImage={msg.profile_image}
                  name={msg.name}
                  username={msg.username}
                  isVip={isVip}
                  size={28}
                />

                {/* Bubble Content */}
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
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                onPress={() => setModalVisible(false)}
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
            onContentSizeChange={() => {
              modalScrollRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {messages.map((msg, idx) => {
              const author = msg.name || msg.username || 'User';
              const avatarUrl = msg.profile_image ? getImageUrl(msg.profile_image) : null;
              const isVip = !!msg.membership_active || msg.role === 'vip';
              const isMe = isAuthenticated && (user?.username === msg.username || user?.name === msg.name);
              const cleanText = cleanMessageText(msg.message);

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
                      size={30}
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

                    <Text style={[styles.msgBubbleText, isMe && { color: '#FFF' }]}>
                      {cleanText}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Modal Input Bar */}
          {isAuthenticated ? (
            <View
              style={[
                styles.modalInputBar,
                {
                  paddingBottom: keyboardVisible
                    ? SPACING.sm
                    : Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12),
                },
              ]}
            >
              <TextInput
                placeholder="Ketik pesan chat..."
                placeholderTextColor={COLORS.textMuted}
                value={modalInputText}
                onChangeText={setModalInputText}
                style={styles.modalTextInput}
                maxLength={250}
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
      </Modal>
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
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    flexShrink: 0,
    alignSelf: 'center',
  },
  openModalBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  messagesBox: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  loadingBox: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  emptyBox: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  msgAvatarWrapper: {
    position: 'relative',
    marginTop: 2,
  },
  msgAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  msgAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgAvatarInitial: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  msgVipBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgContentBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  msgAuthorName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  msgVipTag: {
    backgroundColor: '#D97706',
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRadius: 3,
  },
  msgVipTagText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },
  msgTimeText: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginLeft: 'auto',
  },
  msgBubbleText: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 16,
  },
  cardInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
  modalInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: '#111522',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTextInput: {
    flex: 1,
    height: 42,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalSendBtn: {
    width: 42,
    height: 42,
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
});
