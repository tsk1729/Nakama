import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { C, R } from '../theme';
import { useGame } from '../context/GameContext';

export default function ToastNotification() {
  const { notification } = useGame();
  const anim = useRef(new Animated.Value(0)).current;
  const prevRef = useRef(null);

  useEffect(() => {
    if (notification) {
      prevRef.current = notification;
      Animated.sequence([
        Animated.spring(anim, { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
        Animated.delay(2800),
        Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [notification]);

  const current = notification || prevRef.current;
  if (!current) return null;

  const isError = current.type === 'error';
  const bg = isError ? '#2D0A0A' : '#0A1E2D';
  const border = isError ? C.error : C.info;
  const icon   = isError ? '⚠' : 'ℹ';

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] });
  const opacity    = anim;

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: bg, borderColor: border, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.icon, { color: border }]}>{icon}</Text>
      <Text style={styles.msg} numberOfLines={2}>{current.msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast:  {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: '#0A1E2D',
    borderWidth: 1,
    borderRadius: R.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  icon:   { fontSize: 18 },
  msg:    { flex: 1, color: '#E2E8F0', fontWeight: '600', fontSize: 14 },
});
