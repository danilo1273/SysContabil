const { createClient } = require("@supabase/supabase-js");
const s = createClient("https://invalid-url.supabase.co", "anon-key");
s.from("settings").select("*").single().then(res => console.log("RES:", res)).catch(err => console.log("THROWN:", err.message));

