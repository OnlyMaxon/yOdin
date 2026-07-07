import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../theme/typography';
import WanderingEye from '../../components/WanderingEye';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const AUTH_BG = '#6C35DE';

export default function WelcomeScreen({ navigation }: any) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Glow orb layers */}
      <View style={styles.orbOuter} />
      <View style={styles.orbMid} />
      <View style={styles.orbInner} />

      <View style={styles.content}>
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>y</Text>
          <WanderingEye />
          <Text style={styles.logoText}>din</Text>
        </View>
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
      </View>

      <Text style={styles.brand}>FROM yODIN</Text>
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  logoText: {
    fontSize: 60,
    fontWeight: Typography.fontWeightBold,
    color: '#fff',
    letterSpacing: -1.5,
    lineHeight: 68,
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
  brand: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.28)',
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightMedium,
    letterSpacing: 3,
    marginTop: 12,
  },
});
