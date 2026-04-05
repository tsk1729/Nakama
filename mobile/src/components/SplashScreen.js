import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T } from '../theme';

export default function SplashScreen() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient colors={C.gradBg} style={styles.container}>
      <Animated.Text style={[styles.logo, { opacity: pulse }]}>✕ ○</Animated.Text>
      <Text style={styles.title}>Tic-Tac-Toe</Text>
      <Text style={styles.sub}>Restoring session…</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo:  { fontSize: 56, fontWeight: '900', color: C.accent, letterSpacing: 8 },
  title: { fontSize: 28, fontWeight: '800', color: C.text },
  sub:   { ...T.sub },
});
