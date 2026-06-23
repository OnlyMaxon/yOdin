import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { ColorPalette } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { auth } from '../../services/firebase';
import { resendVerificationEmail } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';

const RESEND_COOLDOWN = 60;

export default function EmailVerificationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top, insets.bottom);
  const setPendingEmailVerification = useAuthStore((s) => s.setPendingEmailVerification);

  const email = auth.currentUser?.email ?? '';
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resentOk, setResentOk] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    setResending(true);
    setResentOk(false);
    try {
      await resendVerificationEmail();
      setResentOk(true);
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setResending(false);
    }
  }

  function handleContinue() {
    setPendingEmailVerification(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>✉️</Text>
        <Text style={styles.title}>{t('auth.verifyEmailTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.verifyEmailSubtitle', { email })}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.openEmailBtn}
          onPress={() => Linking.openURL('mailto:')}
        >
          <Text style={styles.openEmailBtnText}>{t('auth.openEmailApp')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendBtn, (cooldown > 0 || resending) && styles.btnDisabled]}
          onPress={handleResend}
          disabled={cooldown > 0 || resending}
        >
          {resending
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Text style={styles.resendBtnText}>
                {resentOk && cooldown > 0
                  ? `${t('auth.emailResent')} (${cooldown}s)`
                  : cooldown > 0
                  ? `${t('auth.resendEmail')} (${cooldown}s)`
                  : t('auth.resendEmail')}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>{t('auth.continueToApp')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: ColorPalette, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: 24,
      paddingTop: topInset + 24,
      paddingBottom: bottomInset + 24,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    icon: {
      fontSize: 72,
      marginBottom: 24,
    },
    title: {
      fontSize: Typography.fontSizeXXL,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
    },
    subtitle: {
      fontSize: Typography.fontSizeMD,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    actions: {
      gap: 12,
    },
    openEmailBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    openEmailBtnText: {
      color: '#fff',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
    resendBtn: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    resendBtnText: {
      color: c.textPrimary,
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightMedium,
    },
    continueBtn: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    continueBtnText: {
      color: c.textSecondary,
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightMedium,
    },
    btnDisabled: { opacity: 0.5 },
  });
}
