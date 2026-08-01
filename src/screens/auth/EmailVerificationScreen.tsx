import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Text from '../../components/AppText';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { ColorPalette } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { auth } from '../../services/firebase';
import { resendVerificationEmail, logoutUser } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';

const RESEND_COOLDOWN = 60;

export default function EmailVerificationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top, insets.bottom);
  const setPendingEmailVerification = useAuthStore((s) => s.setPendingEmailVerification);

  const email = auth.currentUser?.email ?? '';
  const [hasSent, setHasSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    setResending(true);
    try {
      await resendVerificationEmail();
      setHasSent(true);
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setResending(false);
    }
  }

  // Verification is mandatory: only let the user through if Firebase actually
  // reports the email as verified after a fresh reload.
  async function handleCheck() {
    setChecking(true);
    setNotYet(false);
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        // Force a fresh ID token so its `email_verified` claim is true for the
        // Firestore security rules (the cached token still says false otherwise).
        await auth.currentUser.getIdToken(true);
        setPendingEmailVerification(false);
      } else {
        setNotYet(true);
      }
    } catch {
      setNotYet(true);
    } finally {
      setChecking(false);
    }
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
          style={[styles.resendBtn, (cooldown > 0 || resending) && styles.btnDisabled]}
          onPress={handleResend}
          disabled={cooldown > 0 || resending}
        >
          {resending
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Text style={styles.resendBtnText}>
                {!hasSent
                  ? t('auth.sendEmail')
                  : cooldown > 0
                  ? `${t('auth.resendEmail')} (${cooldown}s)`
                  : t('auth.resendEmail')}
              </Text>
          }
        </TouchableOpacity>

        {notYet ? <Text style={styles.notYet}>{t('auth.notVerifiedYet')}</Text> : null}

        <TouchableOpacity
          style={[styles.continueBtn, checking && styles.btnDisabled]}
          onPress={handleCheck}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.continueBtnText}>{t('auth.iHaveVerified')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchBtn} onPress={() => logoutUser()}>
          <Text style={styles.switchBtnText}>{t('auth.useAnotherAccount')}</Text>
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
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    continueBtnText: {
      color: '#fff',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
    switchBtn: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    switchBtnText: {
      color: c.textSecondary,
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightMedium,
    },
    notYet: {
      color: c.notification,
      fontSize: Typography.fontSizeSM,
      textAlign: 'center',
      marginBottom: 4,
    },
    btnDisabled: { opacity: 0.5 },
  });
}
