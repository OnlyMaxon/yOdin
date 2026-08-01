import i18n, { initLanguage } from './src/services/i18n';
import { enableScreens } from 'react-native-screens';
enableScreens();

import * as SplashScreen from 'expo-splash-screen';
// Keep the native splash on screen until the first real screen is ready
// (RootNavigator hides it once auth state resolves). Prevents a flash of the
// loading screen between the splash and the app.
SplashScreen.preventAutoHideAsync().catch(() => {});

import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { I18nextProvider } from 'react-i18next';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from './src/components/Toast';
import { initTheme } from './src/store/useThemeStore';
import { useTheme } from './src/hooks/useTheme';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

function AppContent() {
  const { isDark, colors } = useTheme();

  const navTheme = useMemo(() => ({
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
      notification: colors.notification,
    },
  }), [isDark, colors]);

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
      <Toast />
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    Promise.all([initTheme(), initLanguage()])
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  if (!ready || !fontsLoaded) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </I18nextProvider>
  );
}
