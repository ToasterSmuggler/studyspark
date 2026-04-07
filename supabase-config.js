export const supabaseConfig = {
  url: "https://cpaedgcrikdbgcmoqllz.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWVkZ2NyaWtkYmdjbW9xbGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzY0ODksImV4cCI6MjA5MDgxMjQ4OX0.ga-8myeXMxIjoIn_cilP5gebmp4wf24FgRWL68Zikic",
};

export function hasSupabaseConfig() {
  return (
    supabaseConfig.url &&
    supabaseConfig.anonKey &&
    supabaseConfig.url !== "YOUR_SUPABASE_URL" &&
    supabaseConfig.anonKey !== "YOUR_SUPABASE_ANON_KEY"
  );
}
