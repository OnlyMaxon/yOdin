import { useState, useEffect } from 'react';
import {
  useAuthRequest,
  useAutoDiscovery,
  makeRedirectUri,
  ResponseType,
  exchangeCodeAsync,
} from 'expo-auth-session';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ensureMicrosoftProfile } from '../services/authService';

const CLIENT_ID = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '';
const REDIRECT_URI = makeRedirectUri({ scheme: 'yodin', path: 'auth' });

export function useMicrosoftAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const discovery = useAutoDiscovery('https://login.microsoftonline.com/common/v2.0');

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: REDIRECT_URI,
      responseType: ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'cancel' || response.type === 'dismiss') return;

    if (response.type === 'error') {
      setError(response.error?.message ?? 'Microsoft sign-in failed');
      return;
    }

    if (response.type !== 'success') return;

    if (!discovery) {
      setError('Auth discovery not ready');
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const { code } = response.params;
        const tokenResult = await exchangeCodeAsync(
          {
            clientId: CLIENT_ID,
            code,
            redirectUri: REDIRECT_URI,
            extraParams: { code_verifier: request!.codeVerifier! },
          },
          discovery,
        );

        const provider = new OAuthProvider('microsoft.com');
        const credential = provider.credential({
          accessToken: tokenResult.accessToken,
          idToken: tokenResult.idToken,
        });
        const result = await signInWithCredential(auth, credential);
        await ensureMicrosoftProfile(result.user);
      } catch (e: any) {
        setError(e.message ?? 'Microsoft sign-in failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [response]);

  return {
    promptAsync,
    disabled: !request || !discovery,
    loading,
    error,
    clearError: () => setError(''),
  };
}
