import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';

const Stack = createNativeStackNavigator();

type AppState = 'loading' | 'auth' | 'onboarding' | 'main';

export default function RootNavigator() {
  const [appState, setAppState] = useState<AppState>('loading');
  const { profile, setProfile } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setAppState('auth');
        return;
      }
      const p = await getUserProfile(user.uid);
      setProfile(p);
      setAppState(p?.nationality ? 'main' : 'onboarding');
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (profile?.nationality && appState === 'onboarding') {
      setAppState('main');
    }
  }, [profile]);

  if (appState === 'loading') return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {appState === 'auth' && <Stack.Screen name="Auth" component={AuthNavigator} />}
      {appState === 'onboarding' && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
      {appState === 'main' && <Stack.Screen name="Main" component={TabNavigator} />}
    </Stack.Navigator>
  );
}
