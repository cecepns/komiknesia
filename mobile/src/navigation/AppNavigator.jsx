import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabNavigator } from './TabNavigator';
import { IntroScreen, INTRO_STORAGE_KEY } from '../screens/IntroScreen';
import { PremiumScreen } from '../screens/PremiumScreen';
import { MangaDetailScreen } from '../screens/MangaDetailScreen';
import { ChapterReaderScreen } from '../screens/ChapterReaderScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { PopularScreen } from '../screens/PopularScreen';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { AccountScreen } from '../screens/AccountScreen';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS } from '../constants/theme';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const [checkingIntro, setCheckingIntro] = useState(true);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_STORAGE_KEY)
      .then((val) => {
        setHasSeenIntro(val === 'true');
      })
      .catch(() => {
        setHasSeenIntro(true);
      })
      .finally(async () => {
        setCheckingIntro(false);
        try {
          await SplashScreen.hideAsync();
        } catch {}
      });
  }, []);

  // Splash Screen view matching app.json splash logo
  if (checkingIntro) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={hasSeenIntro ? 'MainTabs' : 'Intro'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="Intro" component={IntroScreen} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
      <Stack.Screen name="MangaDetail" component={MangaDetailScreen} />
      <Stack.Screen
        name="ChapterReader"
        component={ChapterReaderScreen}
        options={{
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />

      {/* Populer / Popular Screen */}
      <Stack.Screen name="Populer" component={PopularScreen} />
      <Stack.Screen name="Popular" component={PopularScreen} />

      {/* Direct Navigation Compatibility Aliases */}
      <Stack.Screen name="Unduhan" component={DownloadsScreen} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} />
      <Stack.Screen name="Perpustakaan" component={LibraryScreen} />
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="Jelajah" component={ExploreScreen} />
      <Stack.Screen name="Search" component={ExploreScreen} />
      <Stack.Screen name="Beranda" component={HomeScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Akun" component={AccountScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 140,
    height: 140,
  },
});
