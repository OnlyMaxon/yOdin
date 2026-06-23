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
import { useTranslation } from 'react-i18next';
import { registerUser, loginUser } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';
import { getErrorMessage } from '../../services/errorHandler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { ColorPalette } from '../../theme/colors';
import { Typography } from '../../theme/typography';

type Mode = 'register' | 'login';

export default function RegisterScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const [mode, setMode] = useState<Mode>(route?.params?.mode ?? 'register');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {mode === 'register' ? t('auth.register') : t('auth.login')}
        </Text>

        {mode === 'register' && (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('auth.firstName')}
              placeholderTextColor={colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <View style={{ width: 12 }} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('auth.lastName')}
              placeholderTextColor={colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        )}

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

        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

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

function makeStyles(c: ColorPalette, topInset: number) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: c.background,
      paddingHorizontal: 24,
      paddingTop: topInset + 24,
      paddingBottom: 40,
    },
    back: { marginBottom: 32 },
    backText: { fontSize: 24, color: c.textPrimary },
    title: {
      fontSize: Typography.fontSizeXXL,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 32,
    },
    row: { flexDirection: 'row', marginBottom: 0 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      marginBottom: 12,
    },
    error: {
      color: c.notification,
      fontSize: Typography.fontSizeSM,
      marginBottom: 12,
    },
    btn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: {
      color: '#fff',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
    switchMode: { alignItems: 'center', marginTop: 20 },
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
