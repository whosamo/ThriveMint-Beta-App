import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import BottomTabNavigator from './BottomTabNavigator';
import BusinessTabNavigator from './BusinessTabNavigator';
import FreelancerProfileScreen from '../screens/FreelancerProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import BriefGeneratorScreen from '../screens/BriefGeneratorScreen';
import BriefResultScreen from '../screens/BriefResultScreen';
import SavedBriefsScreen from '../screens/SavedBriefsScreen';
import ContractBuilderScreen from '../screens/ContractBuilderScreen';
import ContractReviewScreen from '../screens/ContractReviewScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import AvailabilityScreen from '../screens/AvailabilityScreen';
import FreelancerNotificationsScreen from '../screens/FreelancerNotificationsScreen';
import PortfolioUploadScreen from '../screens/PortfolioUploadScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
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
  ContractBuilder: { projectId: string; conversationId: string };
  ContractReview: { contractId: string; conversationId: string };
  ProjectDetail: { projectId: string; conversationId: string };
  Availability: undefined;
  FreelancerNotifications: undefined;
  PortfolioUpload: undefined;
  ProfileEdit: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, isLoading, hasProfile, profile } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isBusiness = profile?.role === 'business';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!session ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasProfile ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={isBusiness ? BusinessTabNavigator : BottomTabNavigator} />
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
      <Stack.Screen
        name="ContractBuilder"
        component={ContractBuilderScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ContractReview"
        component={ContractReviewScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Availability"
        component={AvailabilityScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="FreelancerNotifications"
        component={FreelancerNotificationsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PortfolioUpload"
        component={PortfolioUploadScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
