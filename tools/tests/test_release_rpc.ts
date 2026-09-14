import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lmkasxsmsgdfqcbpdlzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta2FzeHNtc2dkZnFjYnBkbHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTgyMTAsImV4cCI6MjEwMzA5NDIxMH0.9IcXF7jU3UBiX88U-dcRQRJC3ZtIuy9ftGtZ8X2sxIg";

async function checkReleaseRpc() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("=== Testando admin_release_reservation via anon ===");
  const { data, error } = await supabase.rpc("admin_release_reservation", {
    p_reservation_id: "00000000-0000-0000-0000-000000000000"
  });
  console.log("Resposta RPC:", { data, error: error?.message });
}

checkReleaseRpc();
