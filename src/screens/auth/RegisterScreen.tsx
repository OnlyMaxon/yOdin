import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import TextInput from '../../components/AppTextInput';
import Text from '../../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { registerUser, loginUser } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';
import { getErrorMessage } from '../../services/errorHandler';
import { useUsernameCheck } from '../../hooks/useUsernameCheck';
import { isValidUsername } from '../../utils/mentions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Typography } from '../../theme/typography';

type Mode = 'register' | 'login';

export default function RegisterScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(insets.top, colors);
  const [mode, setMode] = useState<Mode>(route?.params?.mode ?? 'register');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setPendingEmailVerification = useAuthStore((s) => s.setPendingEmailVerification);
  const usernameStatus = useUsernameCheck(username);

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) { setError(t('errors.fillAllFields')); return; }
    if (mode === 'register') {
      if (!firstName.trim() || !lastName.trim()) { setError(t('errors.enterName')); return; }
      if (!isValidUsername(username)) { setError(t('auth.usernameInvalid')); return; }
      if (usernameStatus === 'taken') { setError(t('auth.usernameTaken')); return; }
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await registerUser(email.trim(), password, firstName.trim(), lastName.trim(), username);
        setPendingEmailVerification(true);
      } else {
        await loginUser(email.trim(), password);
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'username-taken') setError(t('auth.usernameTaken'));
      else if (e instanceof Error && e.message === 'username-invalid') setError(t('auth.usernameInvalid'));
      else setError(getErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.title}>
          {mode === 'register' ? t('auth.register') : t('auth.login')}
        </Text>

        {mode === 'register' && (
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.firstName')}
                placeholderTextColor={colors.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                placeholder={t('auth.lastName')}
                placeholderTextColor={colors.textSecondary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        {mode === 'register' && (
          <>
            <View style={styles.inputWrap}>
              <Ionicons name="at-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.username')}
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {usernameStatus === 'checking' && <ActivityIndicator size="small" color={colors.textSecondary} />}
              {usernameStatus === 'available' && <Ionicons name="checkmark-circle" size={18} color={colors.success} />}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <Ionicons name="close-circle" size={18} color={colors.notification} />
              )}
            </View>
            {(usernameStatus === 'available' || usernameStatus === 'taken' || usernameStatus === 'invalid') && (
              <Text style={[styles.usernameHint, {
                color: usernameStatus === 'available' ? colors.success : colors.notification,
              }]}>
                {usernameStatus === 'available'
                  ? t('auth.usernameAvailable')
                  : usernameStatus === 'taken'
                    ? t('auth.usernameTaken')
                    : t('auth.usernameInvalid')}
              </Text>
            )}
          </>
        )}

        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {mode === 'login' && (
          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{mode === 'register' ? t('auth.next') : t('auth.login')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchMode}
          onPress={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
        >
          <Text style={styles.switchText}>
            {mode === 'register' ? t('auth.alreadyHaveAccount') : t('auth.noAccount')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(topInset: number, c: import('../../theme/colors').ColorPalette) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: c.background,
      paddingHorizontal: 24,
      paddingTop: topInset + 24,
      paddingBottom: 40,
    },
    back: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: Typography.fontSizeXXL,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 28,
    },
    row: { flexDirection: 'row', marginBottom: 12 },
    inputWrap: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    input: {
      flex: 1,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      paddingVertical: 16,
    },
    error: {
      color: c.notification,
      fontSize: Typography.fontSizeSM,
      marginBottom: 12,
    },
    usernameHint: {
      fontSize: Typography.fontSizeSM,
      marginTop: -6,
      marginBottom: 10,
      marginLeft: 4,
    },
    btn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: {
      color: '#fff',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
    switchMode: { alignItems: 'center', marginTop: 24 },
    switchText: {
      color: c.primary,
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightMedium,
    },
    forgotWrap: { alignSelf: 'flex-end', marginBottom: 4 },
    forgotText: {
      color: c.primary,
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightMedium,
    },
  });
}
