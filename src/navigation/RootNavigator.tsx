import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import * as SplashScreen from 'expo-splash-screen';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { useBlockStore } from '../store/useBlockStore';
import { isModerator } from '../config/moderation';
import i18n from '../services/i18n';
import { LightColors } from '../theme/colors';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';

const Stack = createNativeStackNavigator();

type AppState = 'loading' | 'auth' | 'emailVerification' | 'onboarding' | 'main';

export default function RootNavigator() {
  const [appState, setAppState] = useState<AppState>('loading');
  const { profile, setProfile, setFirebaseUser, pendingEmailVerification, setPendingEmailVerification, setIsModerator } = useAuthStore();

  // Single routing decision for a signed-in user. Email verification is
  // mandatory: an unverified account is held on the verification screen and
  // cannot reach onboarding or the app.
  const routeForUser = useCallback(async (user: User) => {
    try {
      setIsModerator(isModerator(await user.getIdTokenResult()));
    } catch {
      setIsModerator(false);
    }
    // Refresh so a just-clicked verification link is reflected.
    try {
      await user.reload();
    } catch (e) {
      // A signup that the server rejected (re-registering after a ban) loses its
      // Auth record while this app still holds the session. Reloading then fails
      // permanently, and without this the user would sit on the verification
      // screen forever with no way back.
      const code = (e as { code?: string })?.code ?? '';
      if (code.includes('user-not-found') || code.includes('user-disabled') || code.includes('user-token-expired')) {
        await signOut(auth).catch(() => {});
        Alert.alert(i18n.t('auth.registrationBlockedTitle'), i18n.t('auth.registrationBlocked'));
        return;
      }
      /* offline — fall through to the gate */
    }
    if (!user.emailVerified) {
      setPendingEmailVerification(true);
      setAppState('emailVerification');
      return;
    }
    setPendingEmailVerification(false);
    const p = await getUserProfile(user.uid);
    setProfile(p);
    // Load the block lists before the first list renders, so blocked content
    // never flashes on screen and then disappears.
    await useBlockStore.getState().load(user.uid);
    setAppState(p?.nationality ? 'main' : 'onboarding');
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    auth.authStateReady().then(() => {
      unsub = onAuthStateChanged(auth, async (user: User | null) => {
        setFirebaseUser(user);
        if (!user) {
          setIsModerator(false);
          setPendingEmailVerification(false);
          // Block lists are personal; the next person to sign in on this device
          // must not inherit them.
          useBlockStore.getState().reset();
          setAppState('auth');
          return;
        }
        await routeForUser(user);
      });
    });

    return () => unsub?.();
  }, [routeForUser]);

  useEffect(() => {
    if (profile?.nationality && appState === 'onboarding') {
      setAppState('main');
    }
  }, [profile, appState]);

  // When the user confirms verification on the screen (flag flips to false),
  // re-evaluate routing — routeForUser re-checks emailVerified before letting in.
  useEffect(() => {
    if (appState === 'emailVerification' && !pendingEmailVerification && auth.currentUser) {
      routeForUser(auth.currentUser);
    }
  }, [pendingEmailVerification, appState, routeForUser]);

  // Hide the native splash only once the first real screen is known, so the user
  // goes straight from splash → screen with no lavender loading flash in between.
  useEffect(() => {
    if (appState !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [appState]);

  if (appState === 'loading') {
    // Kept on brand (matches the splash) as a fallback — normally the native
    // splash still covers this frame because it isn't hidden until we leave 'loading'.
    return (
      <View style={{ flex: 1, backgroundColor: LightColors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {appState === 'auth' && <Stack.Screen name="Auth" component={AuthNavigator} />}
      {appState === 'emailVerification' && <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />}
      {appState === 'onboarding' && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
      {appState === 'main' && <Stack.Screen name="Main" component={TabNavigator} />}
    </Stack.Navigator>
  );
}
