import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BusinessOnboardingScreen from '../screens/onboarding/BusinessOnboardingScreen';
import FreelancerOnboardingScreen from '../screens/onboarding/FreelancerOnboardingScreen';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export type OnboardingStackParamList = {
  BusinessOnboarding: undefined;
  FreelancerOnboarding: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const initial: keyof OnboardingStackParamList =
    profile.role === 'business' ? 'BusinessOnboarding' : 'FreelancerOnboarding';

  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="BusinessOnboarding" component={BusinessOnboardingScreen} />
      <Stack.Screen name="FreelancerOnboarding" component={FreelancerOnboardingScreen} />
    </Stack.Navigator>
  );
}
