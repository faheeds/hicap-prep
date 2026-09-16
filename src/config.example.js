// Copy this file to `src/config.local.js` and fill in your Supabase project
// keys to run the app against a real backend. `config.local.js` is gitignored.
//
// When neither file is present (or when the values are left blank), the app
// falls back to the pre-Epic-1 shared localStorage blob — useful for the
// automated test suite and for offline demos.
window.__HICAP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Your Plausible Analytics domain (e.g. "hicapprep.com").
  // Leave blank (or omit) to disable analytics. No restart needed.
  plausibleDomain: ""
};
