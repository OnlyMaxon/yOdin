import React, { useEffect, useState } from 'react';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBarProps,
} from '@react-navigation/material-top-tabs';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { subscribeNotifications, cleanupOldNotifications } from '../services/notificationService';
import FeedStack from './FeedStack';
import ForumStack from './ForumStack';
import NotificationsStack from './NotificationsStack';
import ProfileStack from './ProfileStack';
import NewPostModal from '../screens/NewPostModal';
import NewDiscussionModal from '../screens/NewDiscussionModal';
import { TAB_BAR_HEIGHT } from '../constants/layout';

// Tabs where the center button creates content; elsewhere it is inert.
const CREATE_ROUTES = ['Forum', 'Feed'];

// Full-screen nested routes that hide the bottom nav bar — so the keyboard can
// cover the bottom of the screen without the nav buttons jumping up over the
// input (the composer lives on these screens).
const FULLSCREEN_ROUTES = ['DiscussionDetail'];

const Tab = createMaterialTopTabNavigator();

type IconPair = { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap };

const ICONS: Record<string, IconPair> = {
  Forum: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Feed: { active: 'earth', inactive: 'earth-outline' },
  Notifications: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

function TabBar({
  state,
  navigation,
  onCreate,
}: MaterialTopTabBarProps & { onCreate: (route: string) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.bottom);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  // Hide the whole bar on full-screen detail routes (e.g. the discussion thread
  // with its message composer).
  const nestedRoute = getFocusedRouteNameFromRoute(state.routes[state.index]);
  if (nestedRoute && FULLSCREEN_ROUTES.includes(nestedRoute)) return null;

  // The center button creates content only on the Forum/Feed tabs; on the
  // others it is shown disabled so its absence isn't mistaken for a glitch.
  const activeRoute = state.routes[state.index]?.name;
  const canCreate = CREATE_ROUTES.includes(activeRoute);

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const focused = state.index === index;
    const icon = ICONS[route.name];
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };
    const showBadge = route.name === 'Notifications' && unreadCount > 0;
    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tabItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View>
          <Ionicons
            name={focused ? icon.active : icon.inactive}
            size={24}
            color={focused ? colors.tabBarActive : colors.tabBarInactive}
          />
          {showBadge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // The new-post button sits dead-center, splitting the tabs into two halves.
  const mid = Math.floor(state.routes.length / 2);
  return (
    <View style={styles.tabBar}>
      {state.routes.slice(0, mid).map((route, i) => renderTab(route, i))}
      <View style={styles.centerWrap}>
        <TouchableOpacity
          style={[styles.centerBtn, !canCreate && styles.centerBtnDisabled]}
          onPress={() => onCreate(activeRoute)}
          disabled={!canCreate}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={30} color={canCreate ? '#fff' : colors.tabBarInactive} />
        </TouchableOpacity>
      </View>
      {state.routes.slice(mid).map((route, i) => renderTab(route, mid + i))}
    </View>
  );
}

export default function TabNavigator() {
  const [newPostVisible, setNewPostVisible] = useState(false);
  const [newDiscussionVisible, setNewDiscussionVisible] = useState(false);
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const uid = useAuthStore((s) => s.profile?.uid);

  // Keep notifications live for the whole signed-in session so the badge is
  // always accurate and updates in real time, without opening the tab.
  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeNotifications(uid, setNotifications);
    cleanupOldNotifications(uid).catch(() => {});
    return unsubscribe;
  }, [uid, setNotifications]);

  return (
    <>
      <Tab.Navigator
        tabBarPosition="bottom"
        screenOptions={{ swipeEnabled: true }}
        tabBar={(props) => (
          <TabBar
            {...props}
            onCreate={(route) =>
              route === 'Forum' ? setNewDiscussionVisible(true) : setNewPostVisible(true)
            }
          />
        )}
      >
        <Tab.Screen name="Forum" component={ForumStack} />
        <Tab.Screen name="Feed" component={FeedStack} />
        <Tab.Screen name="Notifications" component={NotificationsStack} />
        <Tab.Screen name="Profile" component={ProfileStack} />
      </Tab.Navigator>
      <NewPostModal visible={newPostVisible} onClose={() => setNewPostVisible(false)} />
      <NewDiscussionModal
        visible={newDiscussionVisible}
        onClose={() => setNewDiscussionVisible(false)}
      />
    </>
  );
}

function makeStyles(c: ColorPalette, bottomInset: number) {
  return StyleSheet.create({
    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.tabBar,
      height: TAB_BAR_HEIGHT + bottomInset,
      paddingBottom: bottomInset,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 16,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    },
    centerWrap: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -24,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    },
    centerBtnDisabled: {
      backgroundColor: c.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -9,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.notification,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
    },
  });
}
