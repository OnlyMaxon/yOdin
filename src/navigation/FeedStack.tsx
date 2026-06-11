import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FeedScreen from '../screens/FeedScreen';
import ForumScreen from '../screens/ForumScreen';
import DiscussionDetailScreen from '../screens/DiscussionDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

export type FeedStackParamList = {
  FeedHome: undefined;
  Forum: undefined;
  DiscussionDetail: { discussionId: string; question: string };
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<FeedStackParamList>();

export default function FeedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedHome" component={FeedScreen} />
      <Stack.Screen name="Forum" component={ForumScreen} />
      <Stack.Screen name="DiscussionDetail" component={DiscussionDetailScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
