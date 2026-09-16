// Store layer (Epic 1, E1-5).
//
// Provides Store.load() / Store.save(app) with the same rough contract as
// the pre-Epic-1 loadApp() / saveApp() so the rest of app.html can call
// them without knowing whether persistence goes to Supabase or to the
// browser's localStorage. Any Supabase-specific bookkeeping (row ids,
// insert-vs-update, mapping between the flat APP blob and the normalized
// families/students/attempts tables) is contained here.
//
// In local-only mode (no Supabase config) Store falls back to the same
// STORAGE_KEY blob the prototype has always used, so the smoke test and
// any offline demo continue to work byte-for-byte.
//
// State snapshot shape (unchanged from the prototype so the render loop
// doesn't need to know it changed):
//   {
//     pin: "1234",
//     students: {
//       [id]: {
//         id, name, avatar, color, grade?, cogatLevel?,
//         createdAt, history: [ ... attempts ... ],
//         streak: {current, longest, lastDate},
//         badgesSeen: []
//       }
//     }
//   }

(function () {
  const hicap = (window.__hicap = window.__hicap || {});
  const STORAGE_KEY = "cogat_app_v2";

  const hasWindowStorage = typeof window !== "undefined" && typeof window.storage !== "undefined";
  const hasLocalStorage = typeof localStorage !== "undefined";

  function defaultApp() { return { pin: "1234", students: {} }; }

  // ------------------------------------------------------------------------
  // Local-only path — same behaviour as pre-Epic-1.
  // ------------------------------------------------------------------------
  async function loadLocal() {
    try {
      if (hasWindowStorage) {
        const res = await window.storage.get(STORAGE_KEY, true);
        return res && res.value ? JSON.parse(res.value) : defaultApp();
      }
      if (hasLocalStorage) {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : defaultApp();
      }
    } catch (e) { /* fall through */ }
    return defaultApp();
  }
  function saveLocal(app) {
    try {
      if (hasWindowStorage) {
        window.storage.set(STORAGE_KEY, JSON.stringify(app), true);
      } else if (hasLocalStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
      }
    } catch (e) { console.error("save failed", e); }
  }

  // ------------------------------------------------------------------------
  // Cloud path — Supabase.
  //
  // load(): pulls the caller's family row + all students + a bounded slice
  // of attempts (newest first) and reassembles the APP snapshot.
  //
  // save(): full-family sync. Upserts every student, deletes students that
  // vanished locally, inserts new attempts (identified as "unsaved" via
  // the `_saved` mirror flag), and writes the family's PIN hash blob.
  //
  // ATTEMPTS_LIMIT keeps the initial load bounded — the prototype only
  // renders "last 50" on the parent history screen and the leaderboard,
  // and re-fetching everything on every render is wasteful.
  // ------------------------------------------------------------------------
  const ATTEMPTS_LIMIT = 500;

  function newRowId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    // Fallback if a very old runtime lacks crypto.randomUUID. Not RFC-4122
    // compliant, but Postgres uuid input accepts any 32-hex + dashes shape.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Map DB student row -> in-app student object.
  function studentRowToApp(row, historyForStudent) {
    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      color: row.color,
      grade: row.grade,
      cogatLevel: row.cogat_level,
      createdAt: row.created_at,
      streak: {
        current: row.streak_current || 0,
        longest: row.streak_longest || 0,
        lastDate: row.streak_last_date || null,
      },
      badgesSeen: Array.isArray(row.badges_seen) ? row.badges_seen : [],
      poolCursors: row.pool_cursors && typeof row.pool_cursors === "object" ? row.pool_cursors : {},
      history: historyForStudent || [],
    };
  }

  function attemptRowToApp(row) {
    return {
      _dbId: row.id,       // internal — the render layer doesn't need it, but
      _saved: true,        //   save() reads these to skip already-persisted rows
      date: row.taken_at,
      title: row.title,
      kind: row.kind,
      weekKey: row.week_key,
      correct: row.correct,
      total: row.total,
      bySub: row.by_sub || {},
      wrongQuestions: row.wrong_questions || [],
    };
  }

  function studentAppToRow(st, familyId) {
    return {
      id: st.id,
      family_id: familyId,
      name: st.name,
      avatar: st.avatar,
      color: st.color,
      grade: st.grade || 7,           // default to grade 7 / Level 13 while Epic 5 is unshipped
      cogat_level: st.cogatLevel || 13,
      streak_current: (st.streak && st.streak.current) || 0,
      streak_longest: (st.streak && st.streak.longest) || 0,
      streak_last_date: (st.streak && st.streak.lastDate) || null,
      badges_seen: st.badgesSeen || [],
      pool_cursors: st.poolCursors || {},
    };
  }

  function attemptAppToRow(h, studentId, familyId) {
    return {
      id: h._dbId || newRowId(),
      student_id: studentId,
      family_id: familyId,
      taken_at: h.date || new Date().toISOString(),
      title: h.title,
      kind: h.kind,
      week_key: h.weekKey || null,
      correct: h.correct,
      total: h.total,
      by_sub: h.bySub || {},
      wrong_questions: h.wrongQuestions || [],
    };
  }

  async function loadCloud() {
    const supabase = await hicap.getSupabase();
    const auth = hicap.auth && hicap.auth.currentSession();
    if (!supabase || !auth) return defaultApp();

    const userId = auth.user.id;

    const { data: fam, error: famErr } = await supabase
      .from("families")
      .select("id, parent_pin_hash, consented_at, email_reminders_opted_in, pass_type, pass_expires_at, pass_student_id, stripe_customer_id, stripe_subscription_id, referral_code, referred_by, referred_count, organization_id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (famErr) { console.error("families load failed", famErr); return defaultApp(); }
    if (!fam) return defaultApp(); // trigger should have created one; fall back safely

    const [{ data: students, error: sErr }, { data: attempts, error: aErr }, { data: ownedOrg }, { data: memberOrg }] = await Promise.all([
      supabase.from("students").select("*").eq("family_id", fam.id).order("created_at"),
      supabase.from("attempts")
        .select("*").eq("family_id", fam.id)
        .order("taken_at", { ascending: false })
        .limit(ATTEMPTS_LIMIT),
      // Check if this user owns any org (for the org dashboard in parent home).
      supabase.from("my_owned_orgs").select("id, name, slug, seat_count, seat_expires_at, theme_overrides").maybeSingle(),
      // Fetch the org this family is a member of (for theme_overrides). If the user
      // owns the org, ownedOrg already has theme_overrides; this covers member families.
      fam.organization_id
        ? supabase.from("organizations").select("theme_overrides").eq("id", fam.organization_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (sErr) console.error("students load failed", sErr);
    if (aErr) console.error("attempts load failed", aErr);

    const historyByStudent = {};
    (attempts || []).forEach((row) => {
      (historyByStudent[row.student_id] = historyByStudent[row.student_id] || []).push(attemptRowToApp(row));
    });

    const studentsById = {};
    (students || []).forEach((row) => {
      studentsById[row.id] = studentRowToApp(row, historyByStudent[row.id] || []);
    });

    // One-time referral capture: if this family was not yet attributed to a
    // referrer but the user arrived via a ?ref= link, write referred_by now.
    if (!fam.referred_by) {
      let refCode = null;
      try { refCode = localStorage.getItem("hicap-referral"); } catch (e) { /* noop */ }
      if (refCode && /^[A-Z0-9]{8}$/.test(refCode) && refCode !== (fam.referral_code || "")) {
        const { error: refErr } = await supabase.from("families")
          .update({ referred_by: refCode })
          .eq("id", fam.id);
        if (!refErr) fam.referred_by = refCode;
      }
      try { localStorage.removeItem("hicap-referral"); } catch (e) { /* noop */ }
    }

    return {
      // pin_hash is server-side gated in E1-6; keep a non-numeric placeholder
      // so client PIN comparison always fails and the parent has to use the
      // server verify path.
      pin: fam.parent_pin_hash ? "__server__" : "1234",
      _familyId: fam.id,
      consentedAt: fam.consented_at || null,
      emailRemindersOptedIn: fam.email_reminders_opted_in || false,
      passType: fam.pass_type || "free",
      passExpiresAt: fam.pass_expires_at || null,
      passStudentId: fam.pass_student_id || null,
      stripeCustomerId: fam.stripe_customer_id || null,
      stripeSubscriptionId: fam.stripe_subscription_id || null,
      referralCode: fam.referral_code || "",
      referredBy: fam.referred_by || null,
      referredCount: fam.referred_count || 0,
      students: studentsById,
      ownedOrg: ownedOrg || null,
      // Theme overrides: owner gets them from ownedOrg; member families from memberOrg.
      // Null when the family has no org link (most families).
      orgThemeOverrides: (ownedOrg && ownedOrg.theme_overrides) || (memberOrg && memberOrg.theme_overrides) || null,
    };
  }

  // Save email reminder opt-in (Epic 4, E4-4). Cloud mode updates
  // families.email_reminders_opted_in; local mode stores it in the blob.
  async function saveEmailPreference(app, optIn) {
    const val = !!optIn;
    if (hicap.isCloud) {
      const supabase = await hicap.getSupabase();
      const auth = hicap.auth && hicap.auth.currentSession();
      if (!supabase || !auth || !app._familyId) return;
      const { error } = await supabase.from("families")
        .update({ email_reminders_opted_in: val })
        .eq("id", app._familyId);
      if (error) { console.error("email preference save failed", error); return; }
    }
    app.emailRemindersOptedIn = val;
    if (!hicap.isCloud) saveLocal(app);
  }

  // Record COPPA consent (Epic 2, E2-2). Cloud mode writes the timestamp
  // to families.consented_at via the RLS-scoped update policy; local mode
  // stashes it in the blob so the gate stops re-showing on next boot.
  async function saveConsent(app) {
    const now = new Date().toISOString();
    if (hicap.isCloud) {
      const supabase = await hicap.getSupabase();
      const auth = hicap.auth && hicap.auth.currentSession();
      if (!supabase || !auth || !app._familyId) return null;
      const { error } = await supabase.from("families")
        .update({ consented_at: now })
        .eq("id", app._familyId);
      if (error) { console.error("consent save failed", error); return null; }
    }
    app.consentedAt = now;
    if (!hicap.isCloud) saveLocal(app);
    return now;
  }

  async function saveCloud(app) {
    const supabase = await hicap.getSupabase();
    const auth = hicap.auth && hicap.auth.currentSession();
    if (!supabase || !auth) return;

    let familyId = app._familyId;
    if (!familyId) {
      const { data: fam } = await supabase
        .from("families").select("id").eq("owner_id", auth.user.id).maybeSingle();
      if (!fam) { console.warn("no family row; skipping save"); return; }
      familyId = fam.id;
      app._familyId = familyId;
    }

    // Upsert students. crypto.randomUUID() gave every locally-added student
    // a UUID already, so upsert-by-primary-key is the right shape.
    const studentRows = Object.values(app.students).map((st) => studentAppToRow(st, familyId));
    if (studentRows.length > 0) {
      const { error } = await supabase.from("students").upsert(studentRows, { onConflict: "id" });
      if (error) console.error("students upsert failed", error);
    }

    // Delete students that vanished locally (parent removed them). Compare
    // against the loaded snapshot by asking the server what it still has.
    const { data: dbStudents } = await supabase
      .from("students").select("id").eq("family_id", familyId);
    const localIds = new Set(Object.keys(app.students));
    const toDelete = (dbStudents || []).filter((r) => !localIds.has(r.id)).map((r) => r.id);
    if (toDelete.length > 0) {
      const { error } = await supabase.from("students").delete().in("id", toDelete);
      if (error) console.error("students delete failed", error);
    }

    // Insert new attempts. Anything already loaded from the server carries
    // _saved=true; anything created locally does not.
    const newAttempts = [];
    const newAttemptRefs = []; // parallel list of the in-app history entries so we can mirror ids back precisely
    Object.values(app.students).forEach((st) => {
      (st.history || []).forEach((h) => {
        if (!h._saved) { newAttempts.push(attemptAppToRow(h, st.id, familyId)); newAttemptRefs.push(h); }
      });
    });
    if (newAttempts.length > 0) {
      const { data, error } = await supabase.from("attempts").insert(newAttempts).select("id");
      if (error) console.error("attempts insert failed", error);
      else {
        // Mirror the ids back onto the exact in-app history entries we sent
        // (tracked in newAttemptRefs), so future saves skip them.
        newAttemptRefs.forEach((h, i) => {
          if (data && data[i]) { h._dbId = data[i].id; h._saved = true; }
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  // Public interface. The `newId()` helper lets callers create fresh
  // students/attempts with an id that's valid in either mode.
  // ------------------------------------------------------------------------
  // Load aggregate stats for an org the signed-in user owns.
  // Returns the jsonb payload from get_org_stats(), or null on error.
  async function loadOrgStats(orgId) {
    if (!hicap.isCloud) return null;
    const supabase = await hicap.getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("get_org_stats", { p_org_id: orgId });
    if (error) {
      console.warn("loadOrgStats failed:", error.message);
      return null;
    }
    return data;
  }

  // Import a parsed roster (array of {name, grade}) into org_roster_entries.
  // Returns {inserted, errors} — errors contains rows that failed with reasons.
  async function importOrgRoster(orgId, rows) {
    if (!hicap.isCloud) return { inserted: 0, errors: rows.map((r, i) => ({ row: i + 1, reason: "cloud mode required" })) };
    const supabase = await hicap.getSupabase();
    if (!supabase) return { inserted: 0, errors: [] };

    const toInsert = rows.map((r) => ({
      organization_id: orgId,
      student_first_name: r.name,
      student_grade: r.grade,
    }));

    const { data, error } = await supabase
      .from("org_roster_entries")
      .insert(toInsert)
      .select("id");

    if (error) {
      console.warn("importOrgRoster failed:", error.message);
      return { inserted: 0, errors: [{ row: "all", reason: error.message }] };
    }
    return { inserted: (data || []).length, errors: [] };
  }

  const Store = {
    isCloud: !!hicap.isCloud,
    newId() { return newRowId(); },
    async load() { return hicap.isCloud ? await loadCloud() : await loadLocal(); },
    async save(app) { return hicap.isCloud ? await saveCloud(app) : saveLocal(app); },
    async saveConsent(app) { return await saveConsent(app); },
    async saveEmailPreference(app, optIn) { return await saveEmailPreference(app, optIn); },
    async loadOrgStats(orgId) { return await loadOrgStats(orgId); },
    async importOrgRoster(orgId, rows) { return await importOrgRoster(orgId, rows); },
  };

  hicap.Store = Store;
})();
