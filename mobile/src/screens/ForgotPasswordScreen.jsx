import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export const ForgotPasswordScreen = ({ navigation }) => {
  const { forgotPassword, resetPassword } = useAuth();

  const [step, setStep] = useState(1); // 1 = input identifier, 2 = input OTP & new password
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!identifier.trim()) {
      Alert.alert('Peringatan', 'Silakan masukkan email atau username kamu.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(identifier.trim());
      if (res?.status) {
        Alert.alert(
          'Kode OTP Terkirim',
          'Silakan periksa email kamu untuk melihat kode verifikasi OTP reset password.'
        );
        setStep(2);
      } else {
        Alert.alert('Gagal', res?.error || 'Tidak dapat mengirim kode OTP.');
      }
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otpCode.trim() || !newPassword.trim()) {
      Alert.alert('Peringatan', 'Silakan isi kode OTP dan password baru.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Peringatan', 'Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({
        email: identifier.trim(),
        otp_code: otpCode.trim(),
        new_password: newPassword,
      });

      if (res?.status) {
        Alert.alert('Sukses', 'Password kamu berhasil diubah! Silakan login kembali.', [
          { text: 'Masuk', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        Alert.alert('Gagal', res?.error || 'Kode OTP salah atau telah kadaluarsa.');
      }
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBadge}>
            <Ionicons name="key" size={26} color="#FFF" />
          </View>
          <Text style={styles.title}>Lupa Password?</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Masukkan email atau username yang terdaftar untuk menerima kode verifikasi OTP.'
              : 'Masukkan kode OTP yang dikirimkan ke email dan buat password baru.'}
          </Text>

          <View style={styles.form}>
            {step === 1 ? (
              <>
                <Text style={styles.label}>Email atau Username</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    placeholder="email@example.com"
                    placeholderTextColor={COLORS.textMuted}
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    style={styles.textInput}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Kirim Kode OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Kode OTP</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Contoh: 123456"
                    placeholderTextColor={COLORS.textMuted}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                </View>

                <Text style={styles.label}>Password Baru</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Minimal 6 karakter"
                    placeholderTextColor={COLORS.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    style={styles.textInput}
                  />
                </View>

                <Text style={styles.label}>Konfirmasi Password Baru</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Ulangi password baru"
                    placeholderTextColor={COLORS.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    style={styles.textInput}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Ubah Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep(1)}
                  style={styles.resendBtn}
                >
                  <Text style={styles.resendText}>Kirim ulang kode OTP</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: SPACING.xxl,
    textAlign: 'center',
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  textInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  resendBtn: {
    alignSelf: 'center',
    marginTop: SPACING.lg,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});
