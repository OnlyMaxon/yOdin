import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useMicrosoftAuth } from '../../hooks/useMicrosoftAuth';
import { ColorPalette } from '../../theme/colors';
import { Typography } from '../../theme/typography';

export default function WelcomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { promptAsync, disabled, loading, error, clearError } = useMicrosoftAuth();

  React.useEffect(() => {
    if (!error) return;
    Alert.alert(t('errors.generic'), error, [{ text: 'OK', onPress: clearError }]);
  }, [error]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>yOdin</Text>
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

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.microsoftBtn, (disabled || loading) && styles.microsoftBtnDisabled]}
          onPress={() => promptAsync()}
          disabled={disabled || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#5E5E5E" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="microsoft" size={20} color="#5E5E5E" style={styles.microsoftIcon} />
              <Text style={styles.microsoftBtnText}>{t('auth.signInWithMicrosoft')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(_c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#5B4FE8',
      paddingHorizontal: 32,
      paddingBottom: 48,
      justifyContent: 'space-between',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      fontSize: 56,
      fontWeight: Typography.fontWeightBold,
      color: '#fff',
      marginBottom: 12,
      letterSpacing: -1,
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
      color: 'rgba(255,255,255,0.6)',
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
      color: '#5B4FE8',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
    secondaryBtn: {
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.5)',
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: '#fff',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightMedium,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    dividerText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: Typography.fontSizeSM,
      marginHorizontal: 12,
    },
    microsoftBtn: {
      backgroundColor: '#fff',
      borderRadius: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    microsoftBtnDisabled: { opacity: 0.6 },
    microsoftIcon: { marginRight: 10 },
    microsoftBtnText: {
      color: '#5E5E5E',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
  });
}
