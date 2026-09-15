// Parent-account auth (Epic 1, E1-2).
//
// This module is a thin, testable wrapper around Supabase Auth. It's a no-op
// in local-only mode — the sign-in screen won't render, and the rest of the
// app behaves exactly as it did before Epic 1.
//
// Everything hangs off window.__hicap.auth so the app.html render loop can
// query the current session without importing anything.

(function () {
  const hicap = (window.__hicap = window.__hicap || {});
  const isCloud = !!hicap.isCloud;

  // In-memory mirror of the current session. Supabase-js also stores this in
  // localStorage under the storageKey we pass; this is just a fast read.
  const state = {
    session: null,
    listeners: new Set(),
    ready: !isCloud, // in local mode we're "ready" immediately (there's nothing to wait for)
  };

  function notify() {
    state.listeners.forEach((fn) => {
      try { fn(state.session); } catch (e) { console.error("auth listener failed", e); }
    });
  }

  async function init() {
    if (!isCloud) { state.ready = true; return; }
    const supabase = await hicap.getSupabase();
    const { data } = await supabase.auth.getSession();
    state.session = data.session || null;
    state.ready = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      state.session = session || null;
      notify();
    });
    notify();
  }

  async function signUp(email, password) {
    if (!isCloud) throw new Error("Supabase not configured");
    const supabase = await hicap.getSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    if (!isCloud) throw new Error("Supabase not configured");
    const supabase = await hicap.getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function sendMagicLink(email) {
    if (!isCloud) throw new Error("Supabase not configured");
    const supabase = await hicap.getSupabase();
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!isCloud) return;
    const supabase = await hicap.getSupabase();
    await supabase.auth.signOut();
    state.session = null;
    notify();
  }

  function currentSession() { return state.session; }
  function currentUser() { return state.session ? state.session.user : null; }
  function isAuthenticated() { return isCloud ? !!state.session : true; }
  function needsAuthGate() { return isCloud && !state.session; }
  function isReady() { return state.ready; }
  function onChange(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); }

  hicap.auth = {
    init, signUp, signIn, sendMagicLink, signOut,
    currentSession, currentUser, isAuthenticated, needsAuthGate,
    isReady, onChange,
  };
})();
