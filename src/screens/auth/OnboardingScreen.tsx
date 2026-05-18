import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { auth } from '../../services/firebase';
import { updateUserProfile, getUserProfile } from '../../services/authService';
import { getErrorMessage } from '../../services/errorHandler';
import { useAuthStore } from '../../store/useAuthStore';
import { COUNTRIES, Country } from '../../data/countries';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { profile, setProfile } = useAuthStore();
  const [nationality, setNationality] = useState<Country | null>(null);
  const [location, setLocation] = useState<Country | null>(null);
  const [modalType, setModalType] = useState<'nationality' | 'location' | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  function openModal(type: 'nationality' | 'location') {
    setSearch('');
    setModalType(type);
  }

  function selectCountry(country: Country) {
    if (modalType === 'nationality') setNationality(country);
    else setLocation(country);
    setModalType(null);
  }

  async function handleFinish() {
    if (!nationality || !location) {
      setError('Please select both your nationality and location.');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      const updated = {
        nationality: nationality.name,
        countryCode: nationality.code,
        location: location.name,
      };
      await updateUserProfile(uid, updated);
      const fullProfile = await getUserProfile(uid);
      setProfile(fullProfile);
    } catch (e) {
      setError(getErrorMessage(e));
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.onboardingTitle')}</Text>
      <Text style={styles.subtitle}>{t('auth.onboardingSubtitle')}</Text>

      <Text style={styles.label}>{t('auth.nationality')}</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => openModal('nationality')}>
        {nationality
          ? <Text style={styles.pickerValue}>{nationality.flag}  {nationality.name}</Text>
          : <Text style={styles.pickerPlaceholder}>{t('auth.selectNationality')}</Text>
        }
      </TouchableOpacity>

      <Text style={styles.label}>{t('auth.location')}</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => openModal('location')}>
        {location
          ? <Text style={styles.pickerValue}>{location.flag}  {location.name}</Text>
          : <Text style={styles.pickerPlaceholder}>{t('auth.selectLocation')}</Text>
        }
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleFinish}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{t('auth.finish')}</Text>
        }
      </TouchableOpacity>

      <Modal visible={modalType !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalType === 'nationality' ? t('auth.selectNationalityTitle') : t('auth.selectLocationTitle')}
            </Text>
            <TouchableOpacity onPress={() => setModalType(null)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            placeholder={t('auth.search')}
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.countryItem} onPress={() => selectCountry(item)}>
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: Typography.fontSizeXXL,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.fontSizeMD,
    color: Colors.textSecondary,
    marginBottom: 40,
    lineHeight: 22,
  },
  label: {
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightSemiBold,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 24,
  },
  pickerValue: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary },
  pickerPlaceholder: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary },
  error: { color: Colors.notification, fontSize: Typography.fontSizeSM, marginBottom: 12 },
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
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  modalClose: { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: Typography.fontSizeMD,
    color: Colors.textPrimary,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  countryFlag: { fontSize: 24, marginRight: 12 },
  countryName: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary },
});
