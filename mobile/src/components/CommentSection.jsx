import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiClient, getImageUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { timeAgo } from '../utils/timeAgo';

const { width } = Dimensions.get('window');
const STICKER_MESSAGE_PREFIX = 'KN_STICKER:';

function parseStickerMessage(text) {
  if (typeof text !== 'string' || !text.startsWith(STICKER_MESSAGE_PREFIX)) return null;
  const path = text.slice(STICKER_MESSAGE_PREFIX.length).trim();
  return path || null;
}

function isVipUser(entity) {
  const role = String(entity?.role || '').trim().toLowerCase();
  if (role === 'vip' || role === 'premium') return true;
  if (entity?.membership_active === 1 || entity?.membership_active === true) return true;
  if (entity?.is_membership === 1 || entity?.is_membership === true) return true;
  return false;
}

// Formatted content parser for rich comments (images, bold, italic, strikethrough)
const renderFormattedInline = (text, keyPrefix, onImagePress) => {
  if (!text) return null;
  // Robust regex matching [b]...[/b], [i]...[/i], [s]...[/s], and [img]...[/img] or img]...[/img
  const regex = /\[?(img|b|i|s)\]([\s\S]*?)(?:\[?\/\1\]?|(?=\s|$|\[?(?:img|b|i|s)\]))/gi;
  const elements = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      elements.push(
        <Text key={`${keyPrefix}-t-${lastIdx}`} style={styles.commentBodyText}>
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
            style={styles.commentImgWrapper}
          >
            <Image
              source={{ uri: fullUrl }}
              style={styles.commentUploadedImg}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        );
      }
    } else if (tag === 'b') {
      elements.push(
        <Text key={`${keyPrefix}-b-${match.index}`} style={[styles.commentBodyText, styles.textBold]}>
          {val}
        </Text>
      );
    } else if (tag === 'i') {
      elements.push(
        <Text key={`${keyPrefix}-i-${match.index}`} style={[styles.commentBodyText, styles.textItalic]}>
          {val}
        </Text>
      );
    } else if (tag === 's') {
      elements.push(
        <Text key={`${keyPrefix}-s-${match.index}`} style={[styles.commentBodyText, styles.textStrike]}>
          {val}
        </Text>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    elements.push(
      <Text key={`${keyPrefix}-t-end`} style={styles.commentBodyText}>
        {text.slice(lastIdx)}
      </Text>
    );
  }

  return elements;
};

// Interactive Spoiler Component for React Native Comments
const SpoilerItem = ({ content, onImagePress }) => {
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
      activeOpacity={0.8}
      onPress={() => setRevealed(false)}
    >
      <View style={styles.spoilerHeaderRow}>
        <Ionicons name="eye-outline" size={12} color="#EF4444" />
        <Text style={styles.spoilerRevealedNotice}>SPOILER (Ketuk untuk menyembunyikan)</Text>
      </View>
      <View style={styles.flowRow}>
        {renderFormattedInline(content, 'sp-rev', onImagePress)}
      </View>
    </TouchableOpacity>
  );
};

// Render comment body with BBCode / Spoilers / Stickers / Images
const CommentBody = ({ body, onImagePress }) => {
  if (!body) return null;

  // 1. Sticker
  const stickerPath = parseStickerMessage(body);
  if (stickerPath) {
    const fullUrl = getImageUrl(stickerPath);
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onImagePress && onImagePress(fullUrl)}
        style={styles.stickerWrapper}
      >
        <Image
          source={{ uri: fullUrl }}
          style={styles.stickerImage}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  }

  // 2. Check for [spoiler]...[/spoiler]
  const spoilerRegex = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi;
  if (spoilerRegex.test(body)) {
    const parts = [];
    let lastIndex = 0;
    let match;
    const regex = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi;

    while ((match = regex.exec(body)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <View key={`pre-${lastIndex}`} style={styles.flowRow}>
            {renderFormattedInline(body.slice(lastIndex, match.index), `pre-${lastIndex}`, onImagePress)}
          </View>
        );
      }
      parts.push(
        <SpoilerItem
          key={`spoiler-${match.index}`}
          content={match[1]}
          onImagePress={onImagePress}
        />
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < body.length) {
      parts.push(
        <View key={`post-${lastIndex}`} style={styles.flowRow}>
          {renderFormattedInline(body.slice(lastIndex), `post-${lastIndex}`, onImagePress)}
        </View>
      );
    }

    return <View style={styles.commentBodyWrapper}>{parts}</View>;
  }

  // 3. Regular Formatted Message
  return (
    <View style={styles.flowRow}>
      {renderFormattedInline(body, 'norm', onImagePress)}
    </View>
  );
};

// Reusable Formatting Toolbar
const CommentToolbar = ({ onInsertTag, onInsertSpoiler, onPickImage, onOpenStickers, uploadingImage }) => {
  return (
    <View style={styles.toolbarRow}>
      <TouchableOpacity
        style={styles.toolBtnSmall}
        onPress={() => onInsertTag('b')}
        activeOpacity={0.7}
      >
        <Text style={styles.toolBtnTextBold}>B</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toolBtnSmall}
        onPress={() => onInsertTag('i')}
        activeOpacity={0.7}
      >
        <Text style={styles.toolBtnTextItalic}>I</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toolBtnSmall}
        onPress={() => onInsertTag('s')}
        activeOpacity={0.7}
      >
        <Text style={styles.toolBtnTextStrike}>S</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolBtnSmall, styles.toolBtnSpoiler]}
        onPress={onInsertSpoiler}
        activeOpacity={0.7}
      >
        <Ionicons name="eye-off-outline" size={12} color="#F87171" />
        <Text style={styles.toolBtnSpoilerText}>Spoiler</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolBtnSmall, styles.toolBtnImage]}
        onPress={onPickImage}
        disabled={uploadingImage}
        activeOpacity={0.7}
      >
        {uploadingImage ? (
          <ActivityIndicator size="small" color="#60A5FA" />
        ) : (
          <Ionicons name="image-outline" size={13} color="#60A5FA" />
        )}
        <Text style={styles.toolBtnImageText}>
          {uploadingImage ? 'Upload...' : 'Gambar'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolBtnSmall, styles.toolBtnSticker]}
        onPress={onOpenStickers}
        activeOpacity={0.7}
      >
        <Ionicons name="happy-outline" size={13} color="#F59E0B" />
        <Text style={styles.toolBtnStickerText}>Stiker</Text>
      </TouchableOpacity>
    </View>
  );
};

// Single Comment Item (Parent or Reply)
const CommentItemRow = ({
  comment,
  currentUser,
  isReply = false,
  onReplyPress,
  onDeletePress,
  replyingToId,
  replyText,
  setReplyText,
  submittingReply,
  onSubmitReply,
  onCancelReply,
  onImagePress,
  onInsertTagReply,
  onInsertSpoilerReply,
  onPickImageReply,
  onOpenStickersReply,
  uploadingImageReply,
}) => {
  const isVip = isVipUser(comment);

  // Strict ownership check: Only author of comment can delete their own comment!
  const currentUserId = currentUser?.id != null ? Number(currentUser.id) : null;
  const commentUserId = comment?.user_id != null ? Number(comment.user_id) : null;
  const isOwner = currentUserId !== null && commentUserId !== null && currentUserId === commentUserId;

  const avatarUrl = comment.profile_image ? getImageUrl(comment.profile_image) : null;
  const displayName = comment.name || comment.username || 'Pengguna';
  const isReplyingThis = replyingToId === comment.id;

  return (
    <View style={[styles.commentCard, isReply && styles.replyCard]}>
      {/* User Header */}
      <View style={styles.commentHeader}>
        <View style={styles.commentUserLeft}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={isReply ? styles.replyAvatar : styles.commentAvatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[isReply ? styles.replyAvatarFallback : styles.commentAvatarFallback]}>
              <Text style={styles.avatarInitialText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.userMeta}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}
              </Text>
              {isVip && (
                <View style={styles.vipBadge}>
                  <Ionicons name="sparkles" size={10} color="#FBBF24" />
                  <Text style={styles.vipBadgeText}>VIP</Text>
                </View>
              )}
            </View>
            <Text style={styles.commentTime}>
              {comment.created_at ? timeAgo(comment.created_at) : 'Baru saja'}
            </Text>
          </View>
        </View>

        {/* Delete button (ONLY shown if user is the true author of this comment) */}
        {isOwner && (
          <TouchableOpacity
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onDeletePress(comment.id)}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Body with rich formatting & images */}
      <View style={styles.commentBodyContainer}>
        <CommentBody body={comment.body} onImagePress={onImagePress} />
      </View>

      {/* Action footer */}
      {!isReply && (
        <View style={styles.commentActionRow}>
          <TouchableOpacity
            style={styles.replyActionBtn}
            onPress={() => onReplyPress(comment.id)}
          >
            <Ionicons name="arrow-undo-outline" size={13} color="#9CA3AF" />
            <Text style={styles.replyActionText}>
              {isReplyingThis ? 'Batal Balas' : 'Balas'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inline Reply Input with rich formatting toolbar */}
      {isReplyingThis && (
        <View style={styles.inlineReplyBox}>
          {/* Reply Formatting Toolbar */}
          <CommentToolbar
            onInsertTag={onInsertTagReply}
            onInsertSpoiler={onInsertSpoilerReply}
            onPickImage={onPickImageReply}
            onOpenStickers={onOpenStickersReply}
            uploadingImage={uploadingImageReply}
          />

          <TextInput
            style={styles.inlineReplyInput}
            placeholder={`Balas ${displayName}...`}
            placeholderTextColor="#6B7280"
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <View style={styles.inlineReplyButtons}>
            <TouchableOpacity
              style={styles.inlineCancelBtn}
              onPress={onCancelReply}
            >
              <Text style={styles.inlineCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.inlineSendBtn,
                (!replyText.trim() || submittingReply) && styles.inlineSendBtnDisabled,
              ]}
              disabled={!replyText.trim() || submittingReply}
              onPress={onSubmitReply}
            >
              {submittingReply ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={13} color="#FFF" />
                  <Text style={styles.inlineSendText}>Kirim</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Child Replies */}
      {Array.isArray(comment.replies) && comment.replies.length > 0 && (
        <View style={styles.repliesList}>
          {comment.replies.map((reply) => (
            <CommentItemRow
              key={reply.id}
              comment={reply}
              currentUser={currentUser}
              isReply={true}
              onDeletePress={onDeletePress}
              onImagePress={onImagePress}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export const CommentSection = ({
  mangaId,
  chapterId,
  externalSlug,
  scope,
  navigation,
}) => {
  const { isAuthenticated, user } = useAuth();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // New comment input
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Replying state
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Stickers picker
  const [stickerPickerVisible, setStickerPickerVisible] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [stickersLoading, setStickersLoading] = useState(false);

  // Image Lightbox Preview
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  // Anti-spam cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const fetchComments = useCallback(async (targetPage = 1) => {
    if (!mangaId && !chapterId && !externalSlug) return;
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        limit: 25,
      };
      if (mangaId) params.manga_id = mangaId;
      if (chapterId) params.chapter_id = chapterId;
      if (externalSlug) params.external_slug = externalSlug;
      if (scope) params.scope = scope;

      const res = await apiClient.getComments(params);
      if (res?.status && Array.isArray(res.data)) {
        setComments(res.data);
        const meta = res.meta || {};
        setTotalPages(meta.totalPages || 1);
        setTotalCount(meta.total || res.data.length);
        setPage(targetPage);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.warn('[CommentSection] fetchComments error:', err);
    } finally {
      setLoading(false);
    }
  }, [mangaId, chapterId, externalSlug, scope]);

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  // Load stickers when picker opens
  const openStickerPicker = async () => {
    setStickerPickerVisible(true);
    if (stickers.length > 0) return;

    setStickersLoading(true);
    try {
      const res = await apiClient.getStickers({ page: 1, limit: 60 });
      let list = [];
      if (Array.isArray(res?.data)) list = res.data;
      else if (Array.isArray(res?.data?.items)) list = res.data.items;
      setStickers(list);
    } catch {
      setStickers([]);
    } finally {
      setStickersLoading(false);
    }
  };

  // Insert BBCode Tag into Main Comment or Reply
  const handleInsertTag = (tag, isReply = false) => {
    if (isReply) {
      setReplyText((prev) => `${prev}[${tag}]teks[/${tag}]`);
    } else {
      setCommentBody((prev) => `${prev}[${tag}]teks[/${tag}]`);
    }
  };

  const handleInsertSpoiler = (isReply = false) => {
    const fn = isReply ? setReplyText : setCommentBody;
    fn((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} [spoiler]teks spoiler[/spoiler]` : `[spoiler]teks spoiler[/spoiler]`;
    });
  };

  // Upload image for Main Comment or Reply
  const handlePickImage = async (isReply = false) => {
    if (uploadingImage) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Akses Galeri',
          'Aplikasi membutuhkan izin akses galeri untuk mengunggah foto ke komentar.'
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
      const filename = asset.fileName || asset.uri.split('/').pop() || `comment_${Date.now()}.jpg`;
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
        const fn = isReply ? setReplyText : setCommentBody;
        fn((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} [img]${imgPath}[/img]` : `[img]${imgPath}[/img]`;
        });
      } else {
        Alert.alert('Gagal Mengunggah', 'Tidak dapat memperoleh tautan gambar.');
      }
    } catch (err) {
      console.warn('Image upload error:', err);
      Alert.alert('Gagal', err.message || 'Gagal mengunggah foto ke komentar.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentBody.trim() || submitting || cooldown > 0 || !isAuthenticated) return;
    setSubmitting(true);
    try {
      const res = await apiClient.postComment({
        manga_id: mangaId || undefined,
        chapter_id: chapterId || undefined,
        external_slug: externalSlug || undefined,
        body: commentBody.trim(),
      });
      if (res?.status) {
        setCommentBody('');
        setCooldown(10);
        fetchComments(1);
      } else {
        Alert.alert('Gagal Mengirim', res?.error || 'Tidak dapat mengirim komentar');
      }
    } catch (err) {
      Alert.alert('Kesalahan', err?.message || 'Gagal mengirim komentar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendSticker = async (stickerPath) => {
    if (!stickerPath || submitting || cooldown > 0 || !isAuthenticated) return;
    setStickerPickerVisible(false);
    setSubmitting(true);
    try {
      if (replyingToId) {
        const res = await apiClient.postComment({
          manga_id: mangaId || undefined,
          chapter_id: chapterId || undefined,
          external_slug: externalSlug || undefined,
          parent_id: replyingToId,
          body: `${STICKER_MESSAGE_PREFIX}${stickerPath}`,
        });
        if (res?.status) {
          setReplyingToId(null);
          setReplyText('');
          fetchComments(page);
        } else {
          Alert.alert('Gagal', res?.error || 'Tidak dapat mengirim stiker');
        }
      } else {
        const res = await apiClient.postComment({
          manga_id: mangaId || undefined,
          chapter_id: chapterId || undefined,
          external_slug: externalSlug || undefined,
          body: `${STICKER_MESSAGE_PREFIX}${stickerPath}`,
        });
        if (res?.status) {
          setCooldown(10);
          fetchComments(1);
        } else {
          Alert.alert('Gagal', res?.error || 'Tidak dapat mengirim stiker');
        }
      }
    } catch (err) {
      Alert.alert('Kesalahan', err?.message || 'Gagal mengirim stiker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyPress = (id) => {
    if (!isAuthenticated) {
      if (navigation) navigation.navigate('Login');
      return;
    }
    if (replyingToId === id) {
      setReplyingToId(null);
      setReplyText('');
    } else {
      setReplyingToId(id);
      setReplyText('');
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || submittingReply || !replyingToId) return;
    setSubmittingReply(true);
    try {
      const res = await apiClient.postComment({
        manga_id: mangaId || undefined,
        chapter_id: chapterId || undefined,
        external_slug: externalSlug || undefined,
        parent_id: replyingToId,
        body: replyText.trim(),
      });
      if (res?.status) {
        setReplyingToId(null);
        setReplyText('');
        fetchComments(page);
      } else {
        Alert.alert('Gagal', res?.error || 'Tidak dapat mengirim balasan');
      }
    } catch (err) {
      Alert.alert('Kesalahan', err?.message || 'Gagal mengirim balasan');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteComment = (id) => {
    Alert.alert(
      'Hapus Komentar?',
      'Apakah kamu yakin ingin menghapus komentar ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiClient.deleteComment(id);
              if (res?.status) {
                fetchComments(page);
              } else {
                Alert.alert('Gagal', res?.error || 'Gagal menghapus komentar');
              }
            } catch (err) {
              Alert.alert('Kesalahan', err?.message || 'Gagal menghapus komentar');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="chatbubbles" size={18} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>KOMENTAR</Text>
          {totalCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{totalCount}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchComments(page)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Input Box / Login Prompt */}
      {isAuthenticated ? (
        <View style={styles.inputCard}>
          {/* BBCode & Media Toolbar */}
          <CommentToolbar
            onInsertTag={(tag) => handleInsertTag(tag, false)}
            onInsertSpoiler={() => handleInsertSpoiler(false)}
            onPickImage={() => handlePickImage(false)}
            onOpenStickers={openStickerPicker}
            uploadingImage={uploadingImage}
          />

          <TextInput
            style={styles.mainInput}
            placeholder="Tulis komentar kamu..."
            placeholderTextColor="#6B7280"
            value={commentBody}
            onChangeText={setCommentBody}
            multiline
            maxLength={1000}
          />

          <View style={styles.inputControlsRow}>
            {cooldown > 0 ? (
              <Text style={styles.cooldownText}>Tunggu {cooldown}s</Text>
            ) : (
              <View />
            )}

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!commentBody.trim() || submitting || cooldown > 0) &&
                  styles.sendBtnDisabled,
              ]}
              disabled={!commentBody.trim() || submitting || cooldown > 0}
              onPress={handlePostComment}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Text style={styles.sendBtnText}>Kirim</Text>
                  <Ionicons name="send" size={13} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.loginBanner}>
          <Ionicons name="lock-closed-outline" size={20} color="#FBBF24" />
          <View style={styles.loginBannerTextWrap}>
            <Text style={styles.loginBannerTitle}>Gabung dalam Diskusi</Text>
            <Text style={styles.loginBannerSubtitle}>
              Masuk ke akun untuk menulis komentar dan berinteraksi dengan pembaca lain.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.loginActionBtn}
            onPress={() => navigation && navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.loginActionBtnText}>Masuk</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Comments List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Memuat komentar...</Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={36} color="#4B5563" />
          <Text style={styles.emptyTitle}>Belum Ada Komentar</Text>
          <Text style={styles.emptySubtitle}>
            Jadilah orang pertama yang meninggalkan tanggapan!
          </Text>
        </View>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((item) => (
            <CommentItemRow
              key={item.id}
              comment={item}
              currentUser={user}
              onReplyPress={handleReplyPress}
              onDeletePress={handleDeleteComment}
              replyingToId={replyingToId}
              replyText={replyText}
              setReplyText={setReplyText}
              submittingReply={submittingReply}
              onSubmitReply={handleSubmitReply}
              onCancelReply={() => {
                setReplyingToId(null);
                setReplyText('');
              }}
              onImagePress={(url) => setPreviewImageUrl(url)}
              onInsertTagReply={(tag) => handleInsertTag(tag, true)}
              onInsertSpoilerReply={() => handleInsertSpoiler(true)}
              onPickImageReply={() => handlePickImage(true)}
              onOpenStickersReply={openStickerPicker}
              uploadingImageReply={uploadingImage}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                disabled={page <= 1}
                onPress={() => fetchComments(page - 1)}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={page <= 1 ? '#4B5563' : '#FFF'}
                />
                <Text
                  style={[
                    styles.pageBtnText,
                    page <= 1 && styles.pageBtnTextDisabled,
                  ]}
                >
                  Sebelumnya
                </Text>
              </TouchableOpacity>

              <Text style={styles.pageInfoText}>
                {page} / {totalPages}
              </Text>

              <TouchableOpacity
                style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                disabled={page >= totalPages}
                onPress={() => fetchComments(page + 1)}
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    page >= totalPages && styles.pageBtnTextDisabled,
                  ]}
                >
                  Berikutnya
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={page >= totalPages ? '#4B5563' : '#FFF'}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* STICKER PICKER MODAL */}
      <Modal
        visible={stickerPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStickerPickerVisible(false)}
      >
        <View style={styles.stickerModalOverlay}>
          <View style={styles.stickerModalCard}>
            <View style={styles.stickerModalHeader}>
              <View style={styles.stickerModalTitleRow}>
                <Ionicons name="happy" size={18} color="#FBBF24" />
                <Text style={styles.stickerModalTitle}>Pilih Stiker</Text>
              </View>
              <TouchableOpacity
                onPress={() => setStickerPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {stickersLoading ? (
              <View style={styles.stickersLoadingBox}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.stickersLoadingText}>Memuat daftar stiker...</Text>
              </View>
            ) : stickers.length === 0 ? (
              <Text style={styles.noStickersText}>Tidak ada stiker yang tersedia.</Text>
            ) : (
              <ScrollView
                contentContainerStyle={styles.stickersGrid}
                showsVerticalScrollIndicator={false}
              >
                {stickers.map((stk) => {
                  const path = stk.image_path || stk.image || stk.url;
                  if (!path) return null;
                  return (
                    <TouchableOpacity
                      key={stk.id || path}
                      style={styles.stickerItemBtn}
                      activeOpacity={0.7}
                      onPress={() => handleSendSticker(path)}
                    >
                      <Image
                        source={{ uri: getImageUrl(path) }}
                        style={styles.stickerItemImg}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
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
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>

            <Image
              source={{ uri: previewImageUrl }}
              style={styles.imageLightboxImg}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  countBadgeText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },
  refreshBtn: {
    padding: 6,
  },

  // Input Card
  inputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  mainInput: {
    color: '#FFF',
    fontSize: 13,
    minHeight: 52,
    maxHeight: 120,
    textAlignVertical: 'top',
    padding: 0,
    marginVertical: SPACING.xs,
  },
  inputControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },

  // Formatting Toolbar
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  toolBtnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
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
  toolBtnStickerText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },

  cooldownText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  sendBtnDisabled: {
    backgroundColor: '#374151',
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Login Banner
  loginBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: 12,
    marginBottom: SPACING.md,
  },
  loginBannerTextWrap: {
    flex: 1,
  },
  loginBannerTitle: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  loginBannerSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 15,
  },
  loginActionBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  loginActionBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Comments List
  commentsList: {
    gap: SPACING.sm,
  },
  commentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 12,
  },
  replyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    marginTop: 8,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E293B',
  },
  commentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAvatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  userMeta: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  vipBadgeText: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '900',
  },
  commentTime: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 1,
  },
  deleteBtn: {
    padding: 4,
  },

  // Body & Formatting
  commentBodyContainer: {
    marginVertical: 4,
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  commentBodyText: {
    color: '#E5E7EB',
    fontSize: 13,
    lineHeight: 18,
  },
  textBold: {
    fontWeight: '900',
    color: '#FFF',
  },
  textItalic: {
    fontStyle: 'italic',
    color: '#FFF',
  },
  textStrike: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  commentBodyWrapper: {
    gap: 4,
  },
  stickerWrapper: {
    marginVertical: 4,
  },
  stickerImage: {
    width: 100,
    height: 100,
  },
  commentImgWrapper: {
    marginVertical: 6,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  commentUploadedImg: {
    width: width * 0.65,
    height: width * 0.48,
    borderRadius: RADIUS.lg,
  },

  // Spoiler
  spoilerHiddenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 4,
  },
  spoilerHiddenText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  spoilerRevealedBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: RADIUS.md,
    padding: 10,
    marginVertical: 4,
  },
  spoilerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  spoilerRevealedNotice: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // Reply actions
  commentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  replyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  replyActionText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Inline Reply
  inlineReplyBox: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inlineReplyInput: {
    color: '#FFF',
    fontSize: 12,
    minHeight: 40,
    padding: 0,
    marginVertical: 6,
  },
  inlineReplyButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  inlineCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inlineCancelText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  inlineSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  inlineSendBtnDisabled: {
    backgroundColor: '#374151',
    opacity: 0.6,
  },
  inlineSendText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Replies List
  repliesList: {
    marginTop: 4,
    paddingLeft: 10,
  },

  // Loading & Empty
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  emptyBox: {
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  emptyTitle: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 11,
  },

  // Pagination
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pageBtnTextDisabled: {
    color: '#6B7280',
  },
  pageInfoText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Sticker Modal
  stickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  stickerModalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.md,
    maxHeight: '60%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  stickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  stickerModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stickerModalTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  stickersLoadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  stickersLoadingText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  noStickersText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 20,
  },
  stickerItemBtn: {
    width: (width - SPACING.md * 2 - 36) / 4,
    height: (width - SPACING.md * 2 - 36) / 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.lg,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stickerItemImg: {
    width: '100%',
    height: '100%',
  },

  // Image Lightbox
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
