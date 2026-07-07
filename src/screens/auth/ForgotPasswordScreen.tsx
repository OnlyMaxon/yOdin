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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Typography } from '../../theme/typography';
import { resetPassword } from '../../services/authService';
import { getErrorMessage } from '../../services/errorHandler';

type State = 'idle' | 'loading' | 'sent';

const AUTH_BG = '#6C35DE';
const INPUT_BG = '#4E25A8';
const INPUT_TEXT = '#FFFFFF';
const INPUT_PLACEHOLDER = 'rgba(255,255,255,0.5)';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(insets.top, colors);

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
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
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
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.resetPasswordTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetPasswordSubtitle')}</Text>

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
            autoFocus
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, state === 'loading' && styles.btnDisabled]}
          onPress={handleSend}
          disabled={state === 'loading'}
        >
          {state === 'loading'
            ? <ActivityIndicator color={colors.primary} />
            : <Text style={styles.btnText}>{t('auth.sendResetLink')}</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(topInset: number, c: import('../../theme/colors').ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
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
      marginBottom: 8,
    },
    subtitle: {
      fontSize: Typography.fontSizeMD,
      color: c.textSecondary,
      marginBottom: 28,
      lineHeight: 22,
    },
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
