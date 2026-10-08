import i18n, { initLanguage } from './src/services/i18n';
import { enableScreens } from 'react-native-screens';
enableScreens();

import * as SplashScreen from 'expo-splash-screen';
// Keep the native splash on screen until the first real screen is ready
// (RootNavigator hides it once auth state resolves). Prevents a flash of the
// loading screen between the splash and the app.
SplashScreen.preventAutoHideAsync().catch(() => {});

import React, { useEffect, useMemo, useState } from 'react';
import { Appearance, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { I18nextProvider } from 'react-i18next';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from './src/components/Toast';
import { initTheme, useThemeStore } from './src/store/useThemeStore';
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
  const preference = useThemeStore((s) => s.preference);

  // Tell the Android side which scheme the app is in. Without this the native
  // layer only knows the *system* setting, and three things go wrong when the
  // app is dark on a light phone:
  //   - DayNight theme resources resolve to their light variants;
  //   - a Modal is its own window, and React Native paints its navigation bar
  //     scrim from UiModeUtils.isDarkMode(), which is why the bar flashed white
  //     on every screen that opens one;
  //   - the system picks light system-bar icons.
  // 'system' passes 'unspecified', which restores MODE_NIGHT_FOLLOW_SYSTEM, so
  // the "follow the phone" option keeps working. (React Native 0.86 dropped
  // null from ColorSchemeName in favour of this explicit value.)
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  // Both of these exist because the app's light/dark setting is a JS preference
  // while the native window follows the *system* one, so a dark app on a light
  // phone left white system chrome around the edges.
  //
  // The root view covers anything the JS tree does not paint, and that is now
  // the whole story for the navigation bar too: Expo SDK 55 made edge-to-edge
  // mandatory on Android, so the bar is always transparent and the root colour
  // shows through on every version. The old `NavigationBar.setBackgroundColorAsync`
  // that used to paint the opaque pre-Android-15 bar was removed along with it.
  //
  // Only the icons still need telling. `setStyle` names the *bar*, not the
  // icons -- 'dark' means a dark bar carrying light content -- so it reads
  // inverted next to the `setButtonStyleAsync` call it replaces.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
    NavigationBar.setStyle(isDark ? 'dark' : 'light');
  }, [colors.background, isDark]);

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
