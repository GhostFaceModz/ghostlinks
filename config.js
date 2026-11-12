/* GhostLinks public config.
   The publishable key is safe in the browser and is meant to be committed.
   NEVER put a service-role key, secret key, or database password here.
   Clear both values to fall back to demo mode (localStorage only). */
window.GHOSTLINKS_CONFIG = {
  supabaseUrl: "https://rswtambjckwmlagydsvf.supabase.co",
  supabaseAnonKey: "sb_publishable_Q6craxzJCpWq_an3BOjeDw_VY69vuYl",
  /* Facebook returns "provider is not enabled" on this project. Set true once it is. */
  FACEBOOK_ENABLED: false
};
