import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { registerUser, loginUser } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';
import { getErrorMessage } from '../../services/errorHandler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Typography } from '../../theme/typography';

type Mode = 'register' | 'login';

const AUTH_BG = '#6C35DE';
const INPUT_BG = '#4E25A8';
const INPUT_TEXT = '#FFFFFF';
const INPUT_PLACEHOLDER = 'rgba(255,255,255,0.5)';

export default function RegisterScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(insets.top, colors);
  const [mode, setMode] = useState<Mode>(route?.params?.mode ?? 'register');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setPendingEmailVerification = useAuthStore((s) => s.setPendingEmailVerification);

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) { setError(t('errors.fillAllFields')); return; }
    if (mode === 'register' && (!firstName.trim() || !lastName.trim())) {
      setError(t('errors.enterName')); return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await registerUser(email.trim(), password, firstName.trim(), lastName.trim());
        setPendingEmailVerification(true);
      } else {
        await loginUser(email.trim(), password);
      }
    } catch (e) {
      setError(getErrorMessage(e, t));
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
              <Ionicons name="person-outline" size={18} color={INPUT_PLACEHOLDER} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.firstName')}
                placeholderTextColor={INPUT_PLACEHOLDER}
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
                placeholderTextColor={INPUT_PLACEHOLDER}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={INPUT_PLACEHOLDER} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={INPUT_PLACEHOLDER}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={INPUT_PLACEHOLDER} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            placeholderTextColor={INPUT_PLACEHOLDER}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={INPUT_PLACEHOLDER} />
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
            ? <ActivityIndicator color={colors.primary} />
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
      backgroundColor: INPUT_BG,
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
      color: INPUT_TEXT,
      paddingVertical: 16,
    },
    error: {
      color: '#EF4444',
      fontSize: Typography.fontSizeSM,
      marginBottom: 12,
    },
    btn: {
      backgroundColor: '#fff',
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: '#6C35DE',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: {
      color: c.primary,
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
