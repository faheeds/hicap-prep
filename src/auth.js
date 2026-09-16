// Parent-account auth — Epic 1, E1-2.
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

  // -------------------------------------------------------------------------
  // Parent-PIN service (Epic 1, E1-6).
  //
  // Delegates PIN verification and change to the verify-pin / set-pin edge
  // functions so no client code ever touches the hash. Rate limiting lives
  // on the server; the response tells us how many attempts are left and
  // when the lockout expires so the UI can render an accurate error.
  // -------------------------------------------------------------------------
  async function callEdge(name, body) {
    if (!isCloud) throw new Error("Supabase not configured");
    const cfg = hicap.config;
    const url = `${cfg.supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`;
    const token = state.session ? state.session.access_token : null;
    if (!token) throw new Error("not signed in");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": cfg.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, body: json };
  }

  async function verifyPin(pin) {
    const r = await callEdge("verify-pin", { pin });
    return { ok: !!(r.body && r.body.ok), status: r.status, ...(r.body || {}) };
  }

  async function setPin(pin, currentPin) {
    const r = await callEdge("set-pin", currentPin ? { pin, currentPin } : { pin });
    return { ok: !!(r.body && r.body.ok), status: r.status, ...(r.body || {}) };
  }

  // -------------------------------------------------------------------------
  // Account deletion (Epic 1, E1-7). Hard-deletes the auth.users row via
  // the delete-account edge function, which cascades through the FK chain
  // to drop every families / students / attempts / badges_earned row.
  // -------------------------------------------------------------------------
  async function deleteAccount() {
    const r = await callEdge("delete-account", {});
    return { ok: !!(r.body && r.body.ok), status: r.status, ...(r.body || {}) };
  }

  hicap.auth = {
    init, signUp, signIn, sendMagicLink, signOut,
    currentSession, currentUser, isAuthenticated, needsAuthGate,
    isReady, onChange,
    verifyPin, setPin, deleteAccount,
  };
})();
