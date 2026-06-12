import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ForumScreen from '../screens/ForumScreen';
import DiscussionDetailScreen from '../screens/DiscussionDetailScreen';

export type ForumStackParamList = {
  ForumHome: undefined;
  DiscussionDetail: { discussionId: string; question: string };
};

const Stack = createNativeStackNavigator<ForumStackParamList>();

export default function ForumStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ForumHome" component={ForumScreen} />
      <Stack.Screen name="DiscussionDetail" component={DiscussionDetailScreen} />
    </Stack.Navigator>
  );
}