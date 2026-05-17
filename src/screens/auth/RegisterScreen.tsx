import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { registerUser, loginUser } from '../../services/authService';
import { getErrorMessage } from '../../services/errorHandler';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

type Mode = 'register' | 'login';

export default function RegisterScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const { setProfile } = useAuthStore();
  const [mode, setMode] = useState<Mode>(route?.params?.mode ?? 'register');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
    if (mode === 'register' && (!firstName.trim() || !lastName.trim())) {
      setError('Please enter your name.'); return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await registerUser(email.trim(), password, firstName.trim(), lastName.trim());
        setProfile({ firstName: firstName.trim(), lastName: lastName.trim() } as any);
        navigation.navigate('Onboarding');
      } else {
        await loginUser(email.trim(), password);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {mode === 'register' ? t('auth.register') : t('auth.login')}
        </Text>

        {mode === 'register' && (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('auth.firstName')}
              placeholderTextColor={Colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <View style={{ width: 12 }} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('auth.lastName')}
              placeholderTextColor={Colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={Colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={Colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{mode === 'register' ? t('auth.next') : t('auth.login')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchMode}
          onPress={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
        >
          <Text style={styles.switchText}>
            {mode === 'register' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  back: { marginBottom: 32 },
  backText: { fontSize: 24, color: Colors.textPrimary },
  title: {
    fontSize: Typography.fontSizeXXL,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    marginBottom: 32,
  },
  row: { flexDirection: 'row', marginBottom: 0 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: Typography.fontSizeMD,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  error: {
    color: Colors.notification,
    fontSize: Typography.fontSizeSM,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightSemiBold,
  },
  switchMode: { alignItems: 'center', marginTop: 20 },
  switchText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightMedium,
  },
});
