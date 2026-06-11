import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import FeedStack from './FeedStack';
import ProfileStack from './ProfileStack';
import NewPostModal from '../screens/NewPostModal';

const Tab = createBottomTabNavigator();

function EmptyScreen() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

export default function TabNavigator() {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: [styles.tabBar, { backgroundColor: colors.tabBar }],
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="Feed"
          component={FeedStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'earth' : 'earth-outline'}
                size={24}
                color={focused ? colors.tabBarActive : colors.tabBarInactive}
              />
            ),
          }}
        />
        <Tab.Screen
          name="NewPost"
          component={EmptyScreen}
          options={{
            tabBarButton: () => (
              <TouchableOpacity
                style={styles.addWrap}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.addBtn, { borderColor: colors.background, shadowColor: colors.primary }]}>
                  <Ionicons name="add" size={28} color="#fff" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={focused ? colors.tabBarActive : colors.tabBarInactive}
              />
            ),
          }}
        />
      </Tab.Navigator>

      <NewPostModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    height: 72,
    paddingBottom: 10,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  addWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5B4FE8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
});
