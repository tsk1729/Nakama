// Nakama JS runtime: authoritative Tic-Tac-Toe with matchmaking + leaderboard + timer
// Plain JavaScript, no external deps.
const MATCH_NAME = "tictactoe";
const OPCODE_MOVE   = 1;
const OPCODE_REMATCH = 2;
const OPCODE_TIMER  = 3;  // timer tick broadcast
const LEADERBOARD_ID = "ttt_global";
const TIMER_SECONDS = 30;  // seconds per turn in timed mode
const TICK_RATE = 2;        // ticks per second (set in matchInit)

function InitModule(ctx, logger, nk, initializer) {
  // Ensure leaderboard exists
  try {
    // nk.leaderboardCreate(id, authoritative, sortOrder, operator, resetSchedule, metadata)
    nk.leaderboardCreate(LEADERBOARD_ID, true, "desc", "incr", null, {});
  } catch (err) {
    if (!String(err).includes("already exists")) {
      logger.error("leaderboardCreate error: %s", err);
    }
  }

  initializer.registerMatch(MATCH_NAME, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchSignal,
    matchTerminate,
  });
  initializer.registerRpc("create_match", rpcCreateMatch);
  initializer.registerRpc("rpc_get_stats", rpcGetStats);
  initializer.registerRpc("rpc_get_leaderboard", rpcGetLeaderboard);
  initializer.registerMatchmakerMatched(matchmakerMatched);
  logger.info("TicTacToe module initialized");
}

function matchmakerMatched(ctx, logger, nk, matches) {
  // Check if any matched user requested a timed mode via properties
  let isTimed = false;
  if (matches && matches.length > 0) {
    isTimed = matches.some(m => {
      const p = m.properties || m.stringProperties || {};
      return p.mode === 'timed';
    });
  }
  const matchId = nk.matchCreate(MATCH_NAME, { timed: isTimed });
  return matchId;
}

function rpcCreateMatch(ctx, logger, nk, payload) {
  // Nakama JS SDK may send payload as a JSON string or a pre-parsed object
  let params = {};
  try {
    if (payload) {
      params = typeof payload === 'string' ? JSON.parse(payload) : payload;
    }
  } catch (_) {}
  const matchId = nk.matchCreate(MATCH_NAME, params);
  return JSON.stringify({ matchId });
}

function rpcGetStats(ctx, logger, nk) {
  const userId = ctx.userId;
  const storageObj = nk.storageRead([
    { collection: "ttt_stats", key: "totals", userId }
  ]);
  const stats = storageObj[0] && storageObj[0].value ? storageObj[0].value : { wins: 0, losses: 0, draws: 0 };
  return JSON.stringify(stats);
}

function rpcGetLeaderboard(ctx, logger, nk, payload) {
  let parsed = {};
  try {
    if (payload) parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch (_) {}
  const limit = Math.min(50, parsed.limit || 20);
  const records = nk.leaderboardRecordsList(LEADERBOARD_ID, null, limit, undefined, undefined);
  const top = records.records.map(r => ({
    rank: r.rank,
    score: r.score,
    username: r.username,
    metadata: r.metadata || {}
  }));
  return JSON.stringify(top);
}

function matchInit(ctx, logger, nk, params) {
  const timed = !!(params && params.timed);
  const state = {
    board: Array(9).fill(null),
    presences: {},
    playerSlots: { X: null, O: null },
    currentTurn: null,
    status: "waiting",
    winner: null,
    moveCount: 0,
    rematchVotes: [],
    // Timer support
    timed,
    timerTicksLeft: timed ? TIMER_SECONDS * TICK_RATE : 0,
  };
  return { state, tickRate: TICK_RATE, label: MATCH_NAME };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  const already = state.presences[presence.sessionId];
  if (already) return { state, accept: true };
  const playerCount = Object.keys(state.presences).length;
  if (playerCount >= 2) {
    return { state, accept: false, rejectMessage: "Match full" };
  }
  return { state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(p => {
    state.presences[p.sessionId] = p;
    if (!state.playerSlots.X) {
      state.playerSlots.X = p.userId;
    } else if (!state.playerSlots.O) {
      state.playerSlots.O = p.userId;
    }
  });

  const joined = Object.keys(state.presences).length;
  if (joined === 2 && state.status === "waiting") {
    state.status = "playing";
    state.currentTurn = state.playerSlots.X;
    state.rematchVotes = [];
  }
  broadcastState(dispatcher, state);
  return { state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(p => delete state.presences[p.sessionId]);
  const remainingUserId = remainingPlayerId(state, presences);
  if (state.status === "playing" && remainingUserId) {
    state.status = "finished";
    state.winner = remainingUserId;
    applyOutcome(state, logger, nk, remainingUserId, true);
  }
  broadcastState(dispatcher, state);
  return { state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  for (const msg of messages) {
    if (msg.opCode === OPCODE_MOVE) {
      handleMove(state, logger, dispatcher, nk, msg);
    } else if (msg.opCode === OPCODE_REMATCH) {
      handleRematch(state, logger, dispatcher, nk, msg);
    }
  }

  // Timer logic: only active during timed playing matches
  if (state.timed && state.status === "playing" && Object.keys(state.presences).length === 2) {
    state.timerTicksLeft -= 1;
    const secsLeft = Math.ceil(state.timerTicksLeft / TICK_RATE);

    // Broadcast timer every tick
    const timerPayload = JSON.stringify({ timerSeconds: Math.max(0, secsLeft) });
    dispatcher.broadcastMessage(OPCODE_TIMER, timerPayload, null, null, false);

    // Auto-forfeit on timeout
    if (state.timerTicksLeft <= 0) {
      const loserId  = state.currentTurn;
      const winnerId = otherPlayerId(state, loserId);
      state.status = "finished";
      state.winner = winnerId;
      applyOutcome(state, logger, nk, winnerId, true);
      broadcastState(dispatcher, state);
    }
  }

  return { state };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  // No special cleanup
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  // No custom signals; simply return current state.
  return { state };
}

function handleMove(state, logger, dispatcher, nk, msg) {
  if (state.status !== "playing") return;
  const idx = parseInt(nk.binaryToString(msg.data));
  if (Number.isNaN(idx) || idx < 0 || idx > 8) return;

  const playerId = msg.sender.userId;
  const symbol = playerSymbol(state, playerId);
  if (!symbol) return;
  if (state.currentTurn !== playerId) return;
  if (state.board[idx]) return;

  state.board[idx] = symbol;
  state.moveCount += 1;

  // Reset timer on a valid move
  if (state.timed) {
    state.timerTicksLeft = TIMER_SECONDS * TICK_RATE;
  }

  const winLine = winnerCheck(state.board, symbol);
  if (winLine) {
    state.status = "finished";
    state.winner = playerId;
    applyOutcome(state, logger, nk, playerId, false);
  } else if (state.moveCount >= 9) {
    state.status = "finished";
    state.winner = null; // draw
    applyDraw(state, logger, nk);
  } else {
    state.currentTurn = otherPlayerId(state, playerId);
  }

  broadcastState(dispatcher, state);
}

function handleRematch(state, logger, dispatcher, nk, msg) {
  const playerId = msg.sender.userId;
  if (!playerSymbol(state, playerId)) return;
  if (!state.rematchVotes.includes(playerId)) {
    state.rematchVotes.push(playerId);
  }
  if (state.rematchVotes.length === Object.keys(state.presences).length && state.rematchVotes.length === 2) {
    resetBoard(state);
    broadcastState(dispatcher, state);
  }
}

function resetBoard(state) {
  state.board = Array(9).fill(null);
  state.status = Object.keys(state.presences).length === 2 ? "playing" : "waiting";
  state.winner = null;
  state.moveCount = 0;
  // Swap starting player on rematch for fairness
  const prev = state.firstMover || state.playerSlots.X;
  const next = otherPlayerId(state, prev) || state.playerSlots.X;
  state.firstMover = next;
  state.currentTurn = next || null;
  state.rematchVotes = [];
  // Reset timer
  if (state.timed) {
    state.timerTicksLeft = TIMER_SECONDS * TICK_RATE;
  }
}

function applyOutcome(state, logger, nk, winnerId, viaForfeit) {
  const loserId = otherPlayerId(state, winnerId);
  if (winnerId) {
    writeStats(nk, logger, winnerId, { wins: 1 });
    leaderboardScore(nk, logger, winnerId, 2, { viaForfeit: !!viaForfeit });
  }
  if (loserId) {
    writeStats(nk, logger, loserId, { losses: 1 });
    leaderboardScore(nk, logger, loserId, 0, { viaForfeit: !!viaForfeit });
  }
}

function applyDraw(state, logger, nk) {
  const p1 = state.playerSlots.X;
  const p2 = state.playerSlots.O;
  if (p1) {
    writeStats(nk, logger, p1, { draws: 1 });
    leaderboardScore(nk, logger, p1, 1, { draw: true });
  }
  if (p2) {
    writeStats(nk, logger, p2, { draws: 1 });
    leaderboardScore(nk, logger, p2, 1, { draw: true });
  }
}

function writeStats(nk, logger, userId, delta) {
  // Read existing
  const res = nk.storageRead([{ collection: "ttt_stats", key: "totals", userId }]);
  const current = res[0] && res[0].value ? res[0].value : { wins: 0, losses: 0, draws: 0 };
  const updated = {
    wins: (current.wins || 0) + (delta.wins || 0),
    losses: (current.losses || 0) + (delta.losses || 0),
    draws: (current.draws || 0) + (delta.draws || 0),
  };
  logger.info("Writing stats for %s: %s", userId, JSON.stringify(updated));
  nk.storageWrite([{
    collection: "ttt_stats",
    key: "totals",
    userId,
    value: updated,
    permissionRead: 2,
    permissionWrite: 0,
  }]);
}

function leaderboardScore(nk, logger, userId, scoreDelta, metadata) {
  logger.info("Writing leaderboard score for %s: %s", userId, scoreDelta);
  nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, null, scoreDelta, 0, metadata || {});
}

function broadcastState(dispatcher, state) {
  const payload = JSON.stringify({
    board: state.board,
    status: state.status,
    currentTurn: state.currentTurn,
    winner: state.winner,
    moveCount: state.moveCount,
    players: state.playerSlots,
    timed: !!state.timed,
  });
  dispatcher.broadcastMessage(OPCODE_MOVE, payload, null, null, true);
}

function winnerCheck(board, symbol) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  return lines.find(([a, b, c]) => board[a] === symbol && board[b] === symbol && board[c] === symbol);
}

function playerSymbol(state, userId) {
  if (state.playerSlots.X === userId) return "X";
  if (state.playerSlots.O === userId) return "O";
  return null;
}

function otherPlayerId(state, userId) {
  if (!userId) return null;
  return state.playerSlots.X === userId ? state.playerSlots.O : state.playerSlots.X;
}

function remainingPlayerId(state, leavingPresences) {
  const leavingIds = new Set(leavingPresences.map(p => p.userId));
  const others = Object.values(state.presences).filter(p => !leavingIds.has(p.userId));
  return others.length === 1 ? others[0].userId : null;
}

// Export for Nakama JS runtime and for tests when run under Node.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { InitModule };
}
if (typeof globalThis !== "undefined") {
  globalThis.InitModule = InitModule;
}
