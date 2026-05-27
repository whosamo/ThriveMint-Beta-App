import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Navigation />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
