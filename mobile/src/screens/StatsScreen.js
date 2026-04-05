import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R, SHADOW, T } from '../theme';
import { useGame } from '../context/GameContext';

function RingChart({ value, max, color, label, size = 90 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / max, duration: 900, useNativeDriver: false }).start();
  }, [value]);
  const pct = max > 0 ? value / max : 0;
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circum = 2 * Math.PI * r;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Background ring */}
        <View style={{
          position: 'absolute',
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: C.surface,
        }} />
        {/* Progress (approximate with gradient arc) */}
        <LinearGradient
          colors={[color, color + '88']}
          style={{
            position: 'absolute',
            width: size - strokeWidth, height: (size - strokeWidth) * pct,
            bottom: strokeWidth / 2,
            borderRadius: R.full,
            opacity: pct > 0 ? 0.5 : 0,
          }}
        />
        <Text style={{ fontSize: 22, fontWeight: '900', color }}>{value}</Text>
      </View>
      <Text style={[T.sub, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const { session, client } = useGame();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      load();
    }, [session, client])
  );

  async function load() {
    if (!session || !client) return;
    setLoading(true);
    try {
      const res = await client.rpc(session, 'rpc_get_stats', {});
      const s = typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload;
      setStats(s);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (_) {}
    setLoading(false);
  }

  const total  = stats ? (stats.wins + stats.losses + stats.draws) : 0;
  const rate   = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
  const username = session?.username || 'Player';

  return (
    <LinearGradient colors={C.gradBg} style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.headerBox}>
        <View style={styles.avatarLg}>
          <Text style={styles.avatarTxt}>{username.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{username}</Text>
        <Text style={T.sub}>{session?.user_id?.slice(0, 12)}…</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 40 }} />
      ) : (
        <Animated.ScrollView 
          contentContainerStyle={{ padding: 18, gap: 16 }}
          style={{ opacity: fadeAnim }}
          showsVerticalScrollIndicator={true}
        >
          {/* Win Rate Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚡ Win Rate</Text>
            <View style={styles.rateRing}>
              <Text style={styles.rateNum}>{rate}%</Text>
              <Text style={T.sub}>{total} games played</Text>
            </View>
            <View style={styles.rateBar}>
              <LinearGradient colors={C.gradSuccess} style={[styles.rateSegment, { flex: stats?.wins || 0 + 0.001 }]} />
              <View style={[styles.rateSegment, { flex: stats?.draws || 0 + 0.001, backgroundColor: C.warn }]} />
              <View style={[styles.rateSegment, { flex: stats?.losses || 0 + 0.001, backgroundColor: C.error }]} />
            </View>
            <View style={styles.rateLegend}>
              <LegendDot color={C.success} label={`W ${stats?.wins ?? 0}`} />
              <LegendDot color={C.warn}    label={`D ${stats?.draws ?? 0}`} />
              <LegendDot color={C.error}   label={`L ${stats?.losses ?? 0}`} />
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard label="Wins" value={stats?.wins ?? 0} color={C.success} icon="🏆" />
            <StatCard label="Losses" value={stats?.losses ?? 0} color={C.error} icon="💔" />
            <StatCard label="Draws" value={stats?.draws ?? 0} color={C.warn} icon="🤝" />
          </View>

          {/* Refresh */}
          <TouchableOpacity style={styles.refreshBtn} onPress={load}>
            <Text style={styles.refreshTxt}>↻ Refresh</Text>
          </TouchableOpacity>
        </Animated.ScrollView>
      )}
    </LinearGradient>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '44' }]}>
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <Text style={[styles.statNum, { color }]}>{value}</Text>
      <Text style={T.sub}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={T.mute}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBox:  { alignItems: 'center', paddingTop: 32, paddingBottom: 20, gap: 6 },
  avatarLg:   { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...SHADOW.accent },
  avatarTxt:  { color: '#fff', fontWeight: '900', fontSize: 22 },
  username:   { ...T.h2, marginTop: 4 },
  card:       { backgroundColor: C.card, borderRadius: R.xl, padding: 20, borderWidth: 1, borderColor: C.border, gap: 12, ...SHADOW.md },
  cardTitle:  { ...T.h3 },
  rateRing:   { alignItems: 'center', gap: 4 },
  rateNum:    { fontSize: 40, fontWeight: '900', color: C.text },
  rateBar:    { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  rateSegment:{ height: 10, borderRadius: 5 },
  rateLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  statsGrid:  { flexDirection: 'row', gap: 10 },
  statCard:   { flex: 1, backgroundColor: C.card, borderRadius: R.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.border, gap: 6, ...SHADOW.sm },
  statNum:    { fontSize: 30, fontWeight: '900' },
  refreshBtn: { alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 12, borderRadius: R.full, borderWidth: 1, borderColor: C.accent },
  refreshTxt: { color: C.accent, fontWeight: '700' },
});
