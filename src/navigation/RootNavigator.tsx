import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { isModerator } from '../config/moderation';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';

const Stack = createNativeStackNavigator();

type AppState = 'loading' | 'auth' | 'emailVerification' | 'onboarding' | 'main';

export default function RootNavigator() {
  const [appState, setAppState] = useState<AppState>('loading');
  const { profile, setProfile, setFirebaseUser, pendingEmailVerification, setIsModerator } = useAuthStore();

  useEffect(() => {
    let unsub: (() => void) | null = null;

    auth.authStateReady().then(() => {
      unsub = onAuthStateChanged(auth, async (user: User | null) => {
        setFirebaseUser(user);
        if (!user) {
          setIsModerator(false);
          setAppState('auth');
          return;
        }
        // Read the moderator custom claim from the signed ID token.
        try {
          const token = await user.getIdTokenResult();
          setIsModerator(isModerator(token));
        } catch {
          setIsModerator(false);
        }
        const p = await getUserProfile(user.uid);
        setProfile(p);
        setAppState(p?.nationality ? 'main' : 'onboarding');
      });
    });

    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (profile?.nationality && appState === 'onboarding') {
      setAppState('main');
    }
  }, [profile, appState]);

  useEffect(() => {
    if (pendingEmailVerification && (appState === 'onboarding' || appState === 'main')) {
      setAppState('emailVerification');
    } else if (!pendingEmailVerification && appState === 'emailVerification') {
      setAppState(profile?.nationality ? 'main' : 'onboarding');
    }
  }, [pendingEmailVerification, appState, profile]);

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8F8FF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#5B4FE8" />
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
