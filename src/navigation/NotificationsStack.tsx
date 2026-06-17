import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NotificationsScreen from '../screens/NotificationsScreen';
import DiscussionDetailScreen from '../screens/DiscussionDetailScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

export type NotificationsStackParamList = {
  NotificationsHome: undefined;
  DiscussionDetail: { discussionId: string; question: string };
  UserProfile: { userId: string };
};

const Stack = createNativeStackNavigator<NotificationsStackParamList>();

export default function NotificationsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NotificationsHome" component={NotificationsScreen} />
      <Stack.Screen name="DiscussionDetail" component={DiscussionDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  );
}