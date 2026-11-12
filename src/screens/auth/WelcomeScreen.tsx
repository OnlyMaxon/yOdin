import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, TouchableOpacity, StyleSheet, Dimensions, Linking } from 'react-native';
import Text from '../../components/AppText';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../theme/typography';
import { LightColors } from '../../theme/colors';
import { TERMS_URL, PRIVACY_URL } from '../../config/links';
import Logo from '../../components/Logo';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Branded landing hero — always the light-theme purple regardless of scheme.
const AUTH_BG = LightColors.primary;

function useBloom(toScale: number, duration: number, delay = 0) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: toScale, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return anim;
}

export default function WelcomeScreen({ navigation }: any) {
  const { t } = useTranslation();

  const scaleOuter = useBloom(1.14, 2800);
  const scaleMid   = useBloom(1.18, 2200, 400);
  const scaleInner = useBloom(1.22, 1800, 800);

  return (
    <View style={styles.container}>
      {/* Animated bloom orbs */}
      <Animated.View style={[styles.orbOuter, { transform: [{ scale: scaleOuter }] }]} />
      <Animated.View style={[styles.orbMid,   { transform: [{ scale: scaleMid }] }]} />
      <Animated.View style={[styles.orbInner, { transform: [{ scale: scaleInner }] }]} />

      <View style={styles.content}>
        <Logo size={60} />
        <Text style={styles.title}>{t('auth.welcome')}</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Register', { mode: 'register' })}
        >
          <Text style={styles.primaryBtnText}>{t('auth.register')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Register', { mode: 'login' })}
        >
          <Text style={styles.secondaryBtnText}>{t('auth.login')}</Text>
        </TouchableOpacity>

        {/* Guideline 1.2 wants the agreement before registering or logging in,
            and these two buttons are the only ways further in — so the notice
            belongs here as well as on the auth screen itself. */}
        <Text style={styles.terms}>{t('auth.providerTermsNotice')}</Text>
        <View style={styles.termsLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.termsLink}>{t('terms.open')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.termsLink}>{t('settings.privacy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Studio credit. A brand name, so it stays literal rather than going
          through i18n — it reads the same in every language. Was "FROM yODIN",
          which said nothing: this is the yOdin app. */}
      <Text style={styles.brand}>FROM ONLYMAXON STUDIO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_BG,
    paddingHorizontal: 32,
    paddingBottom: 36,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  orbOuter: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: SCREEN_H * 0.28 - 190,
    left: SCREEN_W / 2 - 190,
  },
  orbMid: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.09)',
    top: SCREEN_H * 0.28 - 130,
    left: SCREEN_W / 2 - 130,
  },
  orbInner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.13)',
    top: SCREEN_H * 0.28 - 70,
    left: SCREEN_W / 2 - 70,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightSemiBold,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.fontSizeMD,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  buttons: { gap: 12 },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: AUTH_BG,
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightSemiBold,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightMedium,
  },
  terms: {
    marginTop: 8,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.62)',
    fontSize: Typography.fontSizeXS,
    lineHeight: 17,
  },
  termsLinks: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
  },
  termsLink: {
    color: '#fff',
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightSemiBold,
    textDecorationLine: 'underline',
  },
  brand: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.28)',
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightMedium,
    letterSpacing: 3,
    marginTop: 12,
  },
});
