import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import BottomTabNavigator from './BottomTabNavigator';
import FreelancerProfileScreen from '../screens/FreelancerProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import BriefGeneratorScreen from '../screens/BriefGeneratorScreen';
import BriefResultScreen from '../screens/BriefResultScreen';
import SavedBriefsScreen from '../screens/SavedBriefsScreen';
import { GeneratedBrief } from '../types/brief';
import { colors } from '../theme';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  FreelancerProfile: { freelancerId: string };
  Chat: {
    conversationId: string;
    otherUserId: string;
    otherUserName: string;
    otherUserAvatar?: string | null;
  };
  BriefGenerator: undefined;
  BriefResult: { brief: GeneratedBrief };
  SavedBriefs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, isLoading, hasProfile } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!session ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasProfile ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={BottomTabNavigator} />
      )}
      <Stack.Screen
        name="FreelancerProfile"
        component={FreelancerProfileScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="BriefGenerator"
        component={BriefGeneratorScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="BriefResult"
        component={BriefResultScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SavedBriefs"
        component={SavedBriefsScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
