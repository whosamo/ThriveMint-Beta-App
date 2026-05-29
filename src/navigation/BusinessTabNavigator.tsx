import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import FeedScreen from '../screens/FeedScreen';
import ShortlistScreen from '../screens/ShortlistScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import ConversationsListScreen from '../screens/ConversationsListScreen';
import { colors, typography } from '../theme';

export type BusinessTabParamList = {
  Home: undefined;
  Saved: undefined;
  Projects: undefined;
  Messages: undefined;
};

const Tab = createBottomTabNavigator<BusinessTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '⊕',
    Saved: '❤',
    Projects: '◫',
    Messages: '✉',
  };
  return (
    <Text style={{ fontSize: 20, color: focused ? colors.primary : colors.gray500 }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

export default function BusinessTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.medium,
        },
      })}
    >
      <Tab.Screen name="Home" component={FeedScreen} />
      <Tab.Screen name="Saved" component={ShortlistScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Messages" component={ConversationsListScreen} />
    </Tab.Navigator>
  );
}
