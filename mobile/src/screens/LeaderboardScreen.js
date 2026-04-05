import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R, SHADOW, T } from '../theme';
import { useGame } from '../context/GameContext';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function getRankLabel(rank) {
  if (rank <= 3) return RANK_MEDALS[rank - 1];
  return `#${rank}`;
}

function getScoreColor(rank) {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return C.textSub;
}

function AvatarCircle({ name, rank }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : '??';
  const colors = [
    ['#4F9CF9', '#2B6FD6'],
    ['#A855F7', '#7C3AED'],
    ['#F97316', '#EA580C'],
    ['#22C55E', '#16A34A'],
    ['#EF4444', '#B91C1C'],
    ['#FBBF24', '#D97706'],
  ];
  const ci = (name ? name.charCodeAt(0) : 0) % colors.length;
  return (
    <LinearGradient colors={colors[ci]} style={styles.avatar}>
      <Text style={styles.avatarTxt}>{initials}</Text>
    </LinearGradient>
  );
}

export default function LeaderboardScreen() {
  const { session, client } = useGame();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      headerAnim.setValue(0);
      load();
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, [session, client])
  );

  async function load(fromRefresh = false) {
    if (!session || !client) return;
    if (fromRefresh) setRefreshing(true);
    try {
      const res = await client.rpc(session, 'rpc_get_leaderboard', { limit: 20 });
      const data = typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload;
      setRecords(data || []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }

  function renderItem({ item, index }) {
    const isMe = item.username === session?.username;
    return (
      <Animated.View
        key={String(item.rank)}
        style={[
          styles.row,
          isMe && styles.rowMe,
          { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
        ]}
      >
        <Text style={[styles.rankTxt, { color: getScoreColor(item.rank) }]}>
          {getRankLabel(item.rank)}
        </Text>
        <AvatarCircle name={item.username} rank={item.rank} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.username, isMe && { color: C.accent }]}>
            {item.username || 'Anonymous'} {isMe ? '(You)' : ''}
          </Text>
          <Text style={T.mute}>Score: {item.score}</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreTxt}>{item.score}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <LinearGradient colors={C.gradBg} style={{ flex: 1 }}>
      <Animated.View style={[styles.headerBox, { opacity: headerAnim }]}>
        <Text style={styles.title}>🏆 Top Players</Text>
        <Text style={T.sub}>Global leaderboard · Wins score 2pts · Draws 1pt</Text>
      </Animated.View>
      {loading ? (
        <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.accent} />}
        >
          {records.length === 0 ? (
            <Text style={[T.sub, { textAlign: 'center', marginTop: 40 }]}>No records yet. Play some games!</Text>
          ) : (
            records.map((item, index) => renderItem({ item, index }))
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerBox:  { padding: 20, paddingTop: 28, gap: 4 },
  title:      { ...T.h1 },
  list:       { padding: 16, gap: 10, paddingBottom: 40 },
  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.border, gap: 12, ...SHADOW.sm },
  rowMe:      { borderColor: C.accent, backgroundColor: '#0A1A2E' },
  rankTxt:    { fontSize: 20, fontWeight: '900', width: 34, textAlign: 'center' },
  avatar:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { color: '#fff', fontWeight: '800', fontSize: 14 },
  username:   { color: C.text, fontWeight: '700', fontSize: 15 },
  scoreBadge: { backgroundColor: C.surface, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  scoreTxt:   { color: C.accent, fontWeight: '800', fontSize: 13 },
});
