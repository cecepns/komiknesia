import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AdPopup } from './src/components/AdPopup';
import { COLORS } from './src/constants/theme';

// Hold native splash screen until React Native app tree is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.surfaceBorder,
    notification: COLORS.primary,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <AuthProvider>
        <NavigationContainer theme={navigationTheme}>
          <AppNavigator />
          <AdPopup />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
