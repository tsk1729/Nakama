import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as nakamajs from '@heroiclabs/nakama-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GameContext = createContext(null);

const STORAGE_KEY = 'nakama_session_v1';

export function GameProvider({ children }) {
  const [session, setSession]       = useState(null);
  const [socket, setSocket]         = useState(null);
  const [client, setClient]         = useState(null);
  const [userEmail, setUserEmail]   = useState('');
  const [matchId, setMatchId]       = useState(null);
  const [matchState, setMatchState] = useState(null);
  const [mySymbol, setMySymbol]     = useState(null);
  const [timerSecs, setTimerSecs]   = useState(null);
  const [notification, setNotification] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true); // true while restoring session
  const socketRef = useRef(null);

  const [serverHost, setServerHost] = useState(process.env.EXPO_PUBLIC_NAKAMA_HOST || '127.0.0.1');
  const [serverPort, setServerPort] = useState(process.env.EXPO_PUBLIC_NAKAMA_PORT || '7350');
  const [serverKey,  setServerKey]  = useState(process.env.EXPO_PUBLIC_NAKAMA_KEY  || 'defaultkey');

  const displayName = userEmail || session?.username || 'Player';

  // ── On mount: restore saved session ──────────────────────────────────────
  useEffect(() => {
    restoreSession().finally(() => setBootstrapping(false));
  }, []);

  async function restoreSession() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const { token, refresh_token, host, port, key, email } = saved;
      if (!token) return;

      const h = host || '127.0.0.1';
      const p = port || '7350';
      const k = key  || 'defaultkey';
      setServerHost(h); setServerPort(p); setServerKey(k);
      if (email) setUserEmail(email);

      const cli = makeClient(k, h, p);
      setClient(cli);

      let sess = nakamajs.Session.restore(token, refresh_token);
      if (sess.isexpired(Date.now() / 1000)) {
        try {
          sess = await cli.sessionRefresh(sess);
          await saveSession(sess, h, p, k, email);
        } catch (_) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          return;
        }
      }
      setSession(sess);
      await openSocket(cli, sess);
    } catch (_) {
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }

  async function saveSession(sess, h, p, k, email) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: sess.token, refresh_token: sess.refresh_token,
      host: h, port: p, key: k, email: email || '',
    }));
  }

  function makeClient(k, h, p) {
    const cli = new nakamajs.Client(k, h, p, false);
    cli.ssl = false;
    return cli;
  }

  function notify(type, msg) {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3500);
  }

  async function login({ email, password, isSignup, host, port, key }) {
    const h = host || serverHost;
    const p = port || serverPort;
    const k = key  || serverKey;
    if (host) setServerHost(h);
    if (port) setServerPort(p);
    if (key)  setServerKey(k);

    const cli = makeClient(k, h, p);
    setClient(cli);

    const sess = await cli.authenticateEmail(email, password, isSignup, undefined);

    // Nakama's authenticateEmail with create=true is "login OR create" — it never
    // throws for existing users. Check sess.created to detect this case.
    if (isSignup && !sess.created) {
      throw new Error('Email already registered. Please log in instead.');
    }

    // On new signup, replace the random auto-generated username with the full email
    // so it shows correctly in Nakama console and leaderboard.
    if (sess.created) {
      try {
        await cli.updateAccount(sess, { username: email, displayName: email });
      } catch (_) {
        // Username might already be taken.
      }
    }

    setSession(sess);
    setUserEmail(email);                        // store for display
    await saveSession(sess, h, p, k, email);
    await openSocket(cli, sess);
    return sess;
  }

  async function reconnectSocket() {
    const cli  = client;
    let sess = session;
    if (!cli || !sess) throw new Error('Not authenticated — please log in again.');
    try {
      if (sess.refresh_token) {
        // Refresh token from server to get new access token
        sess = await cli.sessionRefresh(sess);
        setSession(sess);
        // Persist the new tokens!
        await saveSession(sess, cli.host, cli.port, cli.serverkey, userEmail);
      }
    } catch (e) {
      console.error('Session refresh failed:', e);
      // If refresh fails, tokens are dead. Notify and clear session to force logout.
      notify('error', 'Session expired. Please log in again.');
      // Clear all state to force user back to Auth screen
      await logout();
      throw e;
    }

    if (socketRef.current) {
      try { socketRef.current._intentionalClose = true; socketRef.current.disconnect(); } catch (_) {}
      socketRef.current = null;
      setSocket(null);
    }
    await openSocket(cli, sess);
  }

  async function openSocket(cli, sess) {
    const s = cli.createSocket(false, false);
    await s.connect(sess, false);
    setupSocketHandlers(s, sess);
    socketRef.current = s;
    setSocket(s);
  }

  function setupSocketHandlers(s, sess) {
    s._intentionalClose = false;
    s.ondisconnect = () => {
      if (s._intentionalClose) return;
      setSocket(null);
      socketRef.current = null;
      notify('error', 'Lost connection to server. Tap Reconnect.');
    };
    s.onmatchdata     = (data) => handleMatchData(data, sess);
    s.onmatchpresence = () => {};
  }

  function handleMatchData(data, sess) {
    if (data.op_code === 1) {
      const st = JSON.parse(bytesToString(data.data));
      setMatchState(st);
      if (st.timed && timerSecs === null) {
        setTimerSecs(30);
      }
      setMySymbol(prev => {
        if (prev) return prev;
        if (st.players?.X === sess?.user_id) return 'X';
        if (st.players?.O === sess?.user_id) return 'O';
        return null;
      });
    } else if (data.op_code === 3) {
      const t = JSON.parse(bytesToString(data.data));
      setTimerSecs(t.timerSeconds ?? null);
    }
  }

  function bytesToString(b) {
    if (!b) return '';
    if (typeof b === 'string') return b;
    return String.fromCharCode.apply(null, b);
  }

  const logout = useCallback(async () => {
    try {
      if (socketRef.current) {
        socketRef.current._intentionalClose = true;
        socketRef.current.disconnect();
      }
    } catch (_) {}
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    // Always clear state — App.js routes to Auth when session = null
    socketRef.current = null;
    setSession(null);
    setSocket(null);
    setClient(null);
    setMatchId(null);
    setMatchState(null);
    setMySymbol(null);
    setTimerSecs(null);
  }, []);

  const leaveMatch = useCallback(async () => {
    const s = socketRef.current;
    if (s && matchId) { try { await s.leaveMatch(matchId); } catch (_) {} }
    setMatchId(null);
    setMatchState(null);
    setMySymbol(null);
    setTimerSecs(null);
  }, [matchId]);

  return (
    <GameContext.Provider value={{
      session, socket, client, socketRef,
      userEmail,
      matchId, setMatchId,
      matchState, setMatchState,
      mySymbol, setMySymbol,
      timerSecs, setTimerSecs,
      notification,
      bootstrapping,
      serverHost, setServerHost,
      serverPort, setServerPort,
      serverKey, setServerKey,
      login, logout, leaveMatch, reconnectSocket,
      notify,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
