import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lmkasxsmsgdfqcbpdlzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta2FzeHNtc2dkZnFjYnBkbHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTgyMTAsImV4cCI6MjEwMzA5NDIxMH0.9IcXF7jU3UBiX88U-dcRQRJC3ZtIuy9ftGtZ8X2sxIg";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("Chamando RPC get_all_reservations_admin...");
  const { data, error } = await supabase.rpc("get_all_reservations_admin");
  console.log("Resultado RPC:", { count: data?.length, error: error?.message, data });
}

main();
