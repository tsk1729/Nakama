import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Modal, Alert, useWindowDimensions, ScrollView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R, SHADOW, T } from '../theme';
import { useGame } from '../context/GameContext';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export default function GameScreen({ navigation }) {
  const { width: winW } = useWindowDimensions();
  // Ensure the board takes up no more than 90% of screen width, maxed out at 420px.
  const boardMaxWidth = Math.min(winW * 0.9, 420);
  const cellSize = Math.floor((boardMaxWidth - 24) / 3); // Account for 2 gaps (12) + 2 paddings (12)
  const boardWidth = cellSize * 3 + 24;

  const {
    session, socketRef, matchId, matchState, mySymbol,
    timerSecs, leaveMatch, notify,
  } = useGame();

  const [board, setBoard]       = useState(Array(9).fill(null));
  const [status, setStatus]     = useState('waiting');
  const [winner, setWinner]     = useState(null);
  const [currentTurn, setCurrent] = useState(null);
  const [players, setPlayers]   = useState({});
  const [winLine, setWinLine]   = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [rematchVote, setRematchVote] = useState(false);

  const cellAnims = useRef(Array(9).fill(null).map(() => new Animated.Value(0))).current;
  const boardAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const winFlash  = useRef(new Animated.Value(0)).current;

  // Sync matchState into local state
  useEffect(() => {
    if (!matchState) return;
    const st = matchState;
    const newBoard = st.board || Array(9).fill(null);
    setBoard(newBoard);
    setStatus(st.status);
    setWinner(st.winner);
    setCurrent(st.currentTurn);
    setPlayers(st.players || {});

    // Detect win line
    if (st.status === 'finished' && st.winner) {
      const sym = st.players?.X === st.winner ? 'X' : 'O';
      const wl = WIN_LINES.find(([a, b, c]) =>
        newBoard[a] === sym && newBoard[b] === sym && newBoard[c] === sym
      );
      setWinLine(wl || null);
    } else {
      setWinLine(null);
    }

    // Animate new cells
    newBoard.forEach((cell, i) => {
      if (cell) {
        Animated.spring(cellAnims[i], { toValue: 1, damping: 12, stiffness: 180, useNativeDriver: true }).start();
      } else {
        cellAnims[i].setValue(0);
      }
    });

    // Show result
    if (st.status === 'finished') {
      const isWin  = st.winner === session?.user_id;
      const isDraw = !st.winner;
      setResultData({ isWin, isDraw, sym: mySymbol });
      setTimeout(() => {
        setShowResult(true);
        Animated.spring(resultAnim, { toValue: 1, damping: 14, stiffness: 140, useNativeDriver: true }).start();
        if (!isDraw) flashWin();
      }, 600);
      setRematchVote(false);
    } else {
      setShowResult(false);
      resultAnim.setValue(0);
    }
  }, [matchState]);

  function flashWin() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(winFlash, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(winFlash, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      { iterations: 5 }
    ).start();
  }

  // Timer bar animation
  useEffect(() => {
    if (timerSecs === null) { timerAnim.setValue(1); return; }
    Animated.timing(timerAnim, {
      toValue: timerSecs / 30,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [timerSecs]);

  async function sendMove(idx) {
    const s = socketRef.current;
    if (!s || !matchId) return;
    if (status !== 'playing') return;
    if (currentTurn !== session?.user_id) return;
    if (board[idx]) return;
    await s.sendMatchState(matchId, 1, idx.toString());
  }

  async function sendRematch() {
    const s = socketRef.current;
    if (!s || !matchId) return;
    setRematchVote(true);
    await s.sendMatchState(matchId, 2, 'rematch');
  }

  async function handleLeave() {
    if (Platform.OS === 'web') {
      if (window.confirm('You will forfeit. Continue?')) {
        await leaveMatch();
        navigation.goBack();
      }
    } else {
      Alert.alert('Leave Match', 'You will forfeit. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
          await leaveMatch();
          navigation.goBack();
        }},
      ]);
    }
  }

  const isMyTurn   = currentTurn === session?.user_id;
  const opponent   = players.X === session?.user_id ? players.O : players.X;
  const oppSymbol  = mySymbol === 'X' ? 'O' : 'X';
  const turnColor  = mySymbol === 'X' ? C.xColor : C.oColor;
  const timerColor = timerSecs !== null && timerSecs <= 10 ? C.error : C.accent;

  const timerBarColor = timerAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [C.error, C.warn, C.success],
  });

  function statusLabel() {
    if (status === 'waiting') return '⏳ Waiting for opponent…';
    if (status === 'finished') return '';
    return isMyTurn ? '🎯 Your Turn' : '⏳ Opponent\'s Turn';
  }

  return (
    <LinearGradient colors={C.gradBg} style={styles.grad}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Top Bar */}
        <View style={styles.topBar}>
        <PlayerChip symbol="X" userId={players.X} session={session} mySymbol={mySymbol} isActive={currentTurn === players.X && status === 'playing'} />
        <View style={styles.vsBox}>
          {(timerSecs !== null || (matchState && matchState.timed)) && status === 'playing' ? (
            <Text style={[styles.timerNum, { color: timerColor }]}>{timerSecs ?? 30}s</Text>
          ) : (
            <Text style={styles.vsText}>VS</Text>
          )}
        </View>
        <PlayerChip symbol="O" userId={players.O} session={session} mySymbol={mySymbol} isActive={currentTurn === players.O && status === 'playing'} />
      </View>

      {/* Timer Bar */}
      {(timerSecs !== null || (matchState && matchState.timed)) && status === 'playing' && (
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerFill, { flex: timerAnim, backgroundColor: timerBarColor }]} />
        </View>
      )}

      {/* Status */}
      <Text style={[styles.statusTxt, isMyTurn && status === 'playing' && { color: mySymbol === 'X' ? C.xColor : C.oColor }]}>
        {statusLabel()}
      </Text>

      {/* Board */}
      <View style={styles.boardWrapper}>
        {/* Win line overlay */}
        {winLine && (
          <Animated.View
            pointerEvents="none"
            style={[styles.winOverlay, { opacity: winFlash }]}
          />
        )}
        <View style={styles.board}>
          {[0, 1, 2].map(row => (
            <View key={row} style={styles.boardRow}>
              {[0, 1, 2].map(col => {
                const idx = row * 3 + col;
                const cell = board[idx];
                const isWinCell = winLine && winLine.includes(idx);
                const scale = cellAnims[idx].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.15, 1] });
                const cellColor = cell === 'X' ? C.xColor : C.oColor;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.cell,
                      { width: cellSize, height: cellSize },
                      isWinCell && { borderColor: cell === 'X' ? C.xColor : C.oColor, borderWidth: 2.5 },
                      status === 'playing' && isMyTurn && !cell && styles.cellTappable,
                    ]}
                    onPress={() => sendMove(idx)}
                    activeOpacity={0.75}
                  >
                    {cell ? (
                      <Animated.Text style={[styles.cellTxt, { fontSize: cellSize * 0.45, color: cellColor, transform: [{ scale }] }]}>
                        {cell}
                      </Animated.Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Actions */}
      {matchId && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} activeOpacity={0.85}>
            <Text style={styles.leaveTxt}>🚪 Leave</Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>

      {/* Result Modal */}
      <Modal transparent animationType="none" visible={showResult}>
        <View style={styles.modalBg}>
          <Animated.View style={[styles.resultCard, {
            width: Math.min(winW * 0.85, 360),
            transform: [{ scale: resultAnim }, { translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
          }]}>
            <Text style={styles.resultEmoji}>
              {resultData?.isDraw ? '🤝' : resultData?.isWin ? '🏆' : '😔'}
            </Text>
            <Text style={styles.resultTitle}>
              {resultData?.isDraw ? 'Draw!' : resultData?.isWin ? 'You Win!' : 'You Lose!'}
            </Text>
            <Text style={[styles.resultSymbol, { color: mySymbol === 'X' ? C.xColor : C.oColor }]}>
              You played {mySymbol}
            </Text>
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.resultBtn, rematchVote && styles.resultBtnVoted]}
                onPress={sendRematch}
                disabled={rematchVote}
              >
                <Text style={styles.resultBtnTxt}>{rematchVote ? '⏳ Waiting…' : '🔄 Rematch'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resultBtnSecondary} onPress={async () => {
                setShowResult(false);
                await leaveMatch();
                navigation.goBack();
              }}>
                <Text style={styles.resultBtnSecTxt}>🏠 Lobby</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function PlayerChip({ symbol, userId, session, mySymbol, isActive }) {
  const isMe = userId === session?.user_id;
  const label = isMe ? 'You' : 'Opponent';
  const color = symbol === 'X' ? C.xColor : C.oColor;
  const bg    = symbol === 'X' ? C.xBg : C.oBg;
  return (
    <View style={[styles.chip, isActive && { borderColor: color, borderWidth: 1.5 }]}>
      <View style={[styles.chipIcon, { backgroundColor: bg }]}>
        <Text style={[styles.chipSym, { color }]}>{symbol}</Text>
      </View>
      <Text style={styles.chipLabel}>{label}</Text>
      {isActive && <View style={[styles.activeDot, { backgroundColor: color }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  grad:       { flex: 1 },
  scrollContent: { paddingBottom: 40, flexGrow: 1 },
  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20 },
  chip:       { flex: 1, alignItems: 'center', backgroundColor: C.card, borderRadius: R.lg, padding: 12, borderWidth: 1, borderColor: C.border, gap: 6, position: 'relative' },
  chipIcon:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chipSym:    { fontSize: 20, fontWeight: '900' },
  chipLabel:  { ...T.mute, fontSize: 12 },
  activeDot:  { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  vsBox:      { width: 50, alignItems: 'center' },
  vsText:     { ...T.h3, color: C.textMute },
  timerNum:   { fontSize: 22, fontWeight: '900' },
  timerTrack: { height: 4, backgroundColor: C.surface, marginHorizontal: 16, borderRadius: 2, flexDirection: 'row', overflow: 'hidden' },
  timerFill:  { height: 4, borderRadius: 2 },
  statusTxt:  { textAlign: 'center', fontSize: 15, fontWeight: '700', color: C.textSub, marginTop: 12, marginBottom: 8 },
  boardWrapper:{ alignSelf: 'center', position: 'relative', marginTop: 12 },
  winOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(79,156,249,0.12)', borderRadius: R.lg, zIndex: 10 },
  board:      { padding: 6, gap: 6, backgroundColor: C.surface, borderRadius: R.xl, borderWidth: 1, borderColor: C.border },
  boardRow:   { flexDirection: 'row', gap: 6 },
  cell:       { backgroundColor: C.card, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  cellTappable:{ borderColor: C.borderHi },
  cellTxt:    { fontWeight: '900' },
  actions:    { flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 14 },
  leaveBtn:   { backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 28, borderWidth: 1, borderColor: C.border },
  leaveTxt:   { color: C.error, fontWeight: '700', fontSize: 14 },
  // Modal
  modalBg:    { flex: 1, backgroundColor: 'rgba(8,13,23,0.85)', alignItems: 'center', justifyContent: 'center' },
  resultCard: { backgroundColor: C.card, borderRadius: R.xl, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: C.borderHi, gap: 10, ...SHADOW.md },
  resultEmoji:{ fontSize: 60 },
  resultTitle:{ fontSize: 30, fontWeight: '900', color: C.text },
  resultSymbol:{ fontSize: 15, fontWeight: '600' },
  resultActions:{ flexDirection: 'column', width: '100%', gap: 12, marginTop: 16 },
  resultBtn:  { backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', ...SHADOW.accent },
  resultBtnVoted:{ backgroundColor: C.borderHi },
  resultBtnTxt:{ color: '#fff', fontWeight: '800', fontSize: 15 },
  resultBtnSecondary:{ borderRadius: R.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  resultBtnSecTxt:{ color: C.text, fontWeight: '700', fontSize: 15 },
});
