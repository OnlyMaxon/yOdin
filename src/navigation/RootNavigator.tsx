import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { isModerator } from '../config/moderation';
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
    try { await user.reload(); } catch { /* offline — fall through to gate */ }
    if (!user.emailVerified) {
      setPendingEmailVerification(true);
      setAppState('emailVerification');
      return;
    }
    setPendingEmailVerification(false);
    const p = await getUserProfile(user.uid);
    setProfile(p);
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

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: LightColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={LightColors.primary} />
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
