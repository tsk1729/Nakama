import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GameProvider, useGame } from './src/context/GameContext';
import { C } from './src/theme';

import AuthScreen        from './src/screens/AuthScreen';
import LobbyScreen       from './src/screens/LobbyScreen';
import GameScreen        from './src/screens/GameScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import StatsScreen       from './src/screens/StatsScreen';
import ToastNotification from './src/components/ToastNotification';
import SplashScreen      from './src/components/SplashScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card:       C.surface,
    text:       C.text,
    border:     C.border,
  },
};

function TabIcon({ icon, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{icon}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.textMute,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Lobby"
        component={LobbyScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🎮" focused={focused} />,
          tabBarLabel: 'Play',
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏆" focused={focused} />,
          tabBarLabel: 'Ranks',
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
          tabBarLabel: 'Stats',
        }}
      />
    </Tab.Navigator>
  );
}

// Inner navigator reads session from context — must be inside GameProvider
function AppNavigator() {
  const { session, bootstrapping } = useGame();

  // While restoring session from storage, show splash
  if (bootstrapping) return <SplashScreen />;

  return (
    <NavigationContainer theme={NAV_THEME}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: C.bg },
            animationEnabled: true,
          }}
        >
          {session ? (
            // Already logged in — go straight to Tabs
            <>
              <Stack.Screen name="Tabs" component={MainTabs} />
              <Stack.Screen
                name="Game"
                component={GameScreen}
                options={{
                  headerShown: true,
                  headerTitle: 'Match',
                  headerStyle: { backgroundColor: C.surface },
                  headerTintColor: C.text,
                  headerTitleStyle: { fontWeight: '800', fontSize: 18 },
                  gestureEnabled: false,
                }}
              />
            </>
          ) : (
            // Not logged in
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}
        </Stack.Navigator>
        <ToastNotification />
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </GameProvider>
    </SafeAreaProvider>
  );
}
