import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FeedScreen from '../screens/FeedScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import DiscussionDetailScreen from '../screens/DiscussionDetailScreen';

export type FeedStackParamList = {
  FeedHome: undefined;
  UserProfile: { userId: string };
  DiscussionDetail: { discussionId: string; question: string };
};

const Stack = createNativeStackNavigator<FeedStackParamList>();

export default function FeedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedHome" component={FeedScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="DiscussionDetail" component={DiscussionDetailScreen} />
    </Stack.Navigator>
  );
}
