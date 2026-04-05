import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R, SHADOW, T } from '../theme';
import { useGame } from '../context/GameContext';
import { cleanErr, cleanErrAsync } from '../utils/errors';

const MODES = [
  { id: 'classic', label: 'Classic', icon: '♟', desc: 'No time limit' },
  { id: 'timed',   label: 'Timed',   icon: '⏱', desc: '30s per turn' },
];

export default function LobbyScreen({ navigation }) {
  const { session, socket, socketRef, client, setMatchId, setMatchState, setMySymbol,
          logout, notify, reconnectSocket, userEmail } = useGame();
  const [joinId, setJoinId]         = useState('');
  const [searching, setSearching]   = useState(false);
  const [gameMode, setGameMode]     = useState('classic');
  const [privateId, setPrivateId]   = useState('');
  const [reconnecting, setReconnecting] = useState(false);

  const spinAnim = useRef(new Animated.Value(0)).current;

  // Matchmaker matched → navigate to game
  // Depends on `socket` (reactive state) NOT socketRef.current (not tracked by React)
  useEffect(() => {
    if (!socket) return;
    socket.onmatchmakermatched = async (e) => {
      try {
        const match = e.match_id
          ? await socket.joinMatch(e.match_id, null)
          : await socket.joinMatch(null, e.token);
        setMatchId(match.match_id);
        setMatchState(null);
        setMySymbol(null);
        setSearching(false);
        navigation.navigate('Game');
      } catch (err) {
        setSearching(false);
        notify('error', cleanErr(err));
      }
    };
    return () => { socket.onmatchmakermatched = null; };
  }, [socket]);

  // Pulse animation while searching
  useEffect(() => {
    if (!searching) { spinAnim.setValue(0); return; }
    Animated.loop(
      Animated.sequence([
        Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(spinAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [searching]);

  const pulseScale = spinAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const pulseOpacity = spinAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  async function handleReconnect() {
    setReconnecting(true);
    try {
      await reconnectSocket();
      notify('info', 'Reconnected!');
    } catch (e) {
      notify('error', await cleanErrAsync(e));
    } finally {
      setReconnecting(false);
    }
  }

  async function quickPlay() {
    if (!socket) return notify('error', 'Not connected — tap Reconnect below');
    setSearching(true);
    try {
      // addMatchmaker(query, minCount, maxCount, stringProperties?, numericProperties?)
      // Pass mode as a string property so server can read it; empty object if classic
      const mode = gameMode === 'timed' ? 'timed' : 'classic';
      const stringProps = { mode };
      const query = `+properties.mode:${mode}`;
      await socket.addMatchmaker(query, 2, 2, stringProps);
    } catch (e) {
      setSearching(false);
      notify('error', await cleanErrAsync(e));
    }
  }

  async function cancelSearch() {
    setSearching(false);
    // Can't cancel matchmaker directly via JS SDK easily, just stop UI
    notify('info', 'Search cancelled');
  }

  async function createPrivate() {
    if (!client || !session) return notify('error', 'Not connected');
    try {
      // client.rpc() takes a plain object — NOT a JSON string
      const payload = gameMode === 'timed' ? { timed: true } : {};
      const res = await client.rpc(session, 'create_match', payload);
      const data = typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload;
      setPrivateId(data.matchId);
      notify('info', 'Room created! Share the ID below.');
    } catch (e) {
      notify('error', await cleanErrAsync(e));
    }
  }

  async function joinById() {
    const id = joinId.trim();
    if (!id) return notify('error', 'Enter a Match ID');
    if (!socketRef.current) return notify('error', 'Not connected');
    try {
      const match = await socketRef.current.joinMatch(id);
      setMatchId(match.match_id);
      setMatchState(null);
      setMySymbol(null);
      navigation.navigate('Game');
    } catch (e) {
      notify('error', await cleanErrAsync(e));
    }
  }

  async function joinPrivate() {
    if (!privateId) return;
    const id = privateId.trim();
    if (!socketRef.current) return;
    try {
      const match = await socketRef.current.joinMatch(id);
      setMatchId(match.match_id);
      setMatchState(null);
      setMySymbol(null);
      navigation.navigate('Game');
    } catch (e) {
      notify('error', await cleanErrAsync(e));
    }
  }

  function handleLogout() {
    if (Platform.OS === 'web') {
      // Alert.alert is a no-op on web — use browser confirm instead
      if (window.confirm('Are you sure you want to log out?')) {
        logout();
      }
    } else {
      Alert.alert('Log out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => { logout(); } },
      ]);
    }
  }

  // Compute display name: full email takes priority over Nakama's auto-generated username
  const emailName = userEmail || null;
  const rawUn = session?.username;
  const nakamaUn = rawUn && rawUn !== 'true' && rawUn !== 'false' ? rawUn : null;
  const username = emailName || nakamaUn || 'Player';

  return (
    <LinearGradient colors={C.gradBg} style={styles.grad}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Connection status banner */}
        {!socket && (
          <View style={styles.disconnectBanner}>
            <Text style={styles.disconnectTxt}>⚠ Not connected to server</Text>
            <TouchableOpacity style={styles.reconnectBtn} onPress={handleReconnect} disabled={reconnecting}>
              {reconnecting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.reconnectTxt}>Reconnect</Text>
              }
            </TouchableOpacity>
          </View>
        )}
        {socket && (
          <View style={styles.connectedBanner}>
            <Text style={styles.connectedTxt}>🟢 Connected</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Hey, {username} 👋</Text>
            <Text style={T.sub}>Ready to play?</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutTxt}>Log out</Text>
          </TouchableOpacity>
        </View>

        {/* Mode selector */}
        <View style={styles.card}>
          <Text style={T.label}>Game Mode</Text>
          <View style={styles.modeRow}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeCard, gameMode === m.id && styles.modeCardActive]}
                onPress={() => setGameMode(m.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.modeIcon}>{m.icon}</Text>
                <Text style={[styles.modeLabel, gameMode === m.id && { color: C.accent }]}>{m.label}</Text>
                <Text style={styles.modeDesc}>{m.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Play */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Play</Text>
          <Text style={T.sub}>Automatically matched with another player</Text>
          {searching ? (
            <View style={styles.searchingBox}>
              <Animated.View style={{ transform: [{ scale: pulseScale }], opacity: pulseOpacity }}>
                <ActivityIndicator color={C.accent} size="large" />
              </Animated.View>
              <Text style={styles.searchingTxt}>Finding opponent…</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelSearch}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.btnPrimary} onPress={quickPlay} activeOpacity={0.85}>
              <LinearGradient colors={C.gradAccent} style={styles.btnGrad}>
                <Text style={styles.btnTxt}>⚡ Quick Play</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Private Room */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Private Room</Text>
          <Text style={T.sub}>Create a room and share the ID with a friend</Text>
          <TouchableOpacity style={styles.btnOutline} onPress={createPrivate} activeOpacity={0.85}>
            <Text style={styles.btnOutlineTxt}>🔒 Create Room</Text>
          </TouchableOpacity>
          {!!privateId && (
            <View style={styles.privateIdBox}>
              <Text style={T.label}>Room ID</Text>
              <Text style={styles.privateIdTxt} selectable>{privateId}</Text>
              <TouchableOpacity style={styles.btnSmall} onPress={joinPrivate}>
                <Text style={styles.btnSmallTxt}>Join this room →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Join by ID */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join by ID</Text>
          <View style={styles.joinRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={joinId}
              onChangeText={setJoinId}
              placeholder="Paste match ID…"
              placeholderTextColor={C.textMute}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.joinBtn} onPress={joinById}>
              <Text style={styles.btnTxt}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  grad:       { flex: 1 },
  scroll:     { padding: 18, paddingBottom: 40, gap: 14 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingTop: 8 },
  welcome:    { ...T.h2 },
  logoutBtn:  { backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  logoutTxt:  { color: C.error, fontWeight: '700', fontSize: 13 },
  card:       { backgroundColor: C.card, borderRadius: R.xl, padding: 18, borderWidth: 1, borderColor: C.border, ...SHADOW.md, gap: 12 },
  cardTitle:  { ...T.h3 },
  modeRow:    { flexDirection: 'row', gap: 10 },
  modeCard:   { flex: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border },
  modeCardActive:{ borderColor: C.accent, backgroundColor: '#0A1A2E' },
  modeIcon:   { fontSize: 22 },
  modeLabel:  { fontWeight: '700', color: C.text, fontSize: 14 },
  modeDesc:   { ...T.mute, textAlign: 'center' },
  searchingBox:{ alignItems: 'center', gap: 12, paddingVertical: 12 },
  searchingTxt:{ color: C.textSub, fontSize: 15, fontWeight: '500' },
  cancelBtn:  { paddingHorizontal: 20, paddingVertical: 8, borderRadius: R.full, borderWidth: 1, borderColor: C.border },
  cancelTxt:  { color: C.error, fontWeight: '600' },
  btnPrimary: { borderRadius: R.md, overflow: 'hidden', ...SHADOW.accent },
  btnGrad:    { paddingVertical: 15, alignItems: 'center' },
  btnTxt:     { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnOutline: { borderRadius: R.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: C.accent },
  btnOutlineTxt:{ color: C.accent, fontWeight: '700', fontSize: 15 },
  privateIdBox:{ backgroundColor: C.surface, borderRadius: R.md, padding: 14, borderWidth: 1, borderColor: C.borderHi, gap: 6 },
  privateIdTxt:{ color: C.text, fontWeight: '700', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  btnSmall:   { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.accent, borderRadius: R.sm },
  btnSmallTxt:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  joinRow:    { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input:      { backgroundColor: C.surface, color: C.text, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: C.border, fontSize: 14 },
  joinBtn:    { backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: 18, paddingVertical: 13, ...SHADOW.accent },
  // Connection banners
  disconnectBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2D0A0A', borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: C.error },
  disconnectTxt:    { color: C.error, fontWeight: '600', fontSize: 13, flex: 1 },
  reconnectBtn:     { backgroundColor: C.error, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 10, minWidth: 90, alignItems: 'center' },
  reconnectTxt:     { color: '#fff', fontWeight: '700', fontSize: 13 },
  connectedBanner:  { backgroundColor: '#0A2D1A', borderRadius: R.md, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: C.success },
  connectedTxt:     { color: C.success, fontWeight: '600', fontSize: 13 },
});

