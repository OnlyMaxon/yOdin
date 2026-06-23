import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { ColorPalette } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { resetPassword } from '../../services/authService';
import { getErrorMessage } from '../../services/errorHandler';

type State = 'idle' | 'loading' | 'sent';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<State>('idle');

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) { setError(t('errors.fillAllFields')); return; }
    setError('');
    setState('loading');
    try {
      await resetPassword(trimmed);
      setState('sent');
    } catch (e) {
      setError(getErrorMessage(e, t));
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.sentContent}>
          <Text style={styles.sentIcon}>📬</Text>
          <Text style={styles.title}>{t('auth.checkInbox')}</Text>
          <Text style={styles.sentSubtitle}>{t('auth.resetEmailSent', { email: email.trim() })}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('auth.backToLogin')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.resetPasswordTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetPasswordSubtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, state === 'loading' && styles.btnDisabled]}
          onPress={handleSend}
          disabled={state === 'loading'}
        >
          {state === 'loading'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{t('auth.sendResetLink')}</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorPalette, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
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
      marginBottom: 8,
    },
    subtitle: {
      fontSize: Typography.fontSizeMD,
      color: c.textSecondary,
      marginBottom: 32,
      lineHeight: 22,
    },
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
    sentContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    sentIcon: {
      fontSize: 64,
      marginBottom: 24,
    },
    sentSubtitle: {
      fontSize: Typography.fontSizeMD,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 8,
    },
  });
}
