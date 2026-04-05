import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R, SHADOW, T } from '../theme';
import { useGame } from '../context/GameContext';
import { cleanErr, cleanErrAsync } from '../utils/errors';

export default function AuthScreen({ navigation }) {
  const { login, serverHost, serverPort, serverKey, setServerHost, setServerPort, setServerKey } = useGame();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState(serverHost);
  const [port, setPort] = useState(serverPort);
  const [key, setKey] = useState(serverKey);
  const [showServer, setShowServer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handle(isSignup) {
    setError('');
    if (!email || !password) { setError('Email and password are required'); shake(); return; }
    setLoading(true);
    try {
      await login({ email, password, isSignup, host, port, key });
      // Navigation handled automatically by App.js when session is set
    } catch (e) {
      setError(await cleanErrAsync(e));
      shake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={C.gradBg} style={styles.grad}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={[styles.scroll, { flexGrow: 1 }]} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Header */}
          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], alignItems: 'center', marginTop: 60, marginBottom: 36 }}>
            <Text style={styles.logo}>✕ ○</Text>
            <Text style={styles.title}>Tic-Tac-Toe</Text>
            <Text style={styles.tagline}>Real-time multiplayer · Powered by Nakama</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, { opacity: fadeIn, transform: [{ translateX: shakeAnim }, { translateY: slideUp }] }]}>
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardSub}>Sign in or create an account</Text>

            <View style={styles.inputGroup}>
              <Text style={T.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.textMute}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={T.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.textMute}
                secureTextEntry
              />
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTxt}>⚠ {error}</Text>
              </View>
            )}

            <View style={styles.btnRow}>
              {loading ? (
                <ActivityIndicator color={C.accent} size="large" style={{ flex: 1 }} />
              ) : (
                <>
                  <TouchableOpacity style={styles.btnPrimary} onPress={() => handle(false)} activeOpacity={0.85}>
                    <LinearGradient colors={C.gradAccent} style={styles.btnGrad}>
                      <Text style={styles.btnTxt}>Log In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSecondary} onPress={() => handle(true)} activeOpacity={0.85}>
                    <Text style={styles.btnSecTxt}>Sign Up</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Server settings toggle */}
            <TouchableOpacity onPress={() => setShowServer(v => !v)} style={styles.serverToggle}>
              <Text style={styles.serverLink}>{showServer ? '▲ Hide' : '▼ Server'} settings</Text>
            </TouchableOpacity>
            {showServer && (
              <View style={styles.serverPanel}>
                <View style={styles.inputRow}>
                  <View style={{ flex: 2, marginRight: 8 }}>
                    <Text style={T.label}>Host</Text>
                    <TextInput style={styles.input} value={host} onChangeText={setHost} autoCapitalize="none" placeholderTextColor={C.textMute} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={T.label}>Port</Text>
                    <TextInput style={styles.input} value={port} onChangeText={setPort} keyboardType="number-pad" placeholderTextColor={C.textMute} />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={T.label}>Server Key</Text>
                  <TextInput style={styles.input} value={key} onChangeText={setKey} autoCapitalize="none" placeholderTextColor={C.textMute} />
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  grad:       { flex: 1 },
  scroll:     { padding: 20, paddingBottom: 100 },
  logo:       { fontSize: 52, fontWeight: '900', color: C.accent, letterSpacing: 8 },
  title:      { fontSize: 30, fontWeight: '800', color: C.text, marginTop: 8 },
  tagline:    { ...T.sub, marginTop: 6, textAlign: 'center' },
  card:       { backgroundColor: C.card, borderRadius: R.xl, padding: 24, borderWidth: 1, borderColor: C.border, ...SHADOW.md, gap: 16 },
  cardTitle:  { ...T.h2, marginBottom: 2 },
  cardSub:    { ...T.sub },
  inputGroup: { gap: 6 },
  inputRow:   { flexDirection: 'row', gap: 6 },
  input: {
    backgroundColor: C.surface, color: C.text, borderRadius: R.md,
    paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: C.border,
    fontSize: 15,
  },
  errorBox:   { backgroundColor: '#2D0A0A', borderRadius: R.sm, padding: 12, borderWidth: 1, borderColor: C.error },
  errorTxt:   { color: C.error, fontSize: 13, fontWeight: '600' },
  btnRow:     { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnPrimary: { flex: 1, borderRadius: R.md, overflow: 'hidden', ...SHADOW.accent },
  btnGrad:    { paddingVertical: 15, alignItems: 'center' },
  btnTxt:     { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  btnSecondary:{ flex: 1, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: C.accent },
  btnSecTxt:  { color: C.accent, fontWeight: '700', fontSize: 16 },
  serverToggle:{ alignSelf: 'center', marginTop: 4 },
  serverLink: { color: C.accent, fontSize: 13, fontWeight: '600' },
  serverPanel:{ gap: 12, borderTopWidth: 1, borderColor: C.border, paddingTop: 14 },
});
