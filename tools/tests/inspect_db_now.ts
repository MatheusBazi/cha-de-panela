import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lmkasxsmsgdfqcbpdlzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta2FzeHNtc2dkZnFjYnBkbHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTgyMTAsImV4cCI6MjEwMzA5NDIxMH0.9IcXF7jU3UBiX88U-dcRQRJC3ZtIuy9ftGtZ8X2sxIg";

async function inspectDb() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("=== 1. Consultando 'gifts' ===");
  const { data: gifts, error: gErr } = await supabase.from("gifts").select("id, name, slug, is_active").limit(10);
  console.log("Gifts error:", gErr?.message);
  console.log("Gifts count:", gifts?.length);
  if (gifts && gifts.length > 0) {
    console.log("Sample gifts:", gifts.slice(0, 3));
  }

  console.log("\n=== 2. Consultando 'public_gifts_view' ===");
  const { data: view, error: vErr } = await supabase.from("public_gifts_view").select("id, name, is_reserved").limit(10);
  console.log("View error:", vErr?.message);
  console.log("View count:", view?.length);
  if (view && view.length > 0) {
    console.log("Reserved in view:", view.filter((v: any) => v.is_reserved));
  }

  console.log("\n=== 3. Consultando 'reservations' ===");
  const { data: res, error: rErr } = await supabase.from("reservations").select("*");
  console.log("Reservations error:", rErr?.message);
  console.log("Reservations count:", res?.length);
  if (res && res.length > 0) {
    console.log("Reservations rows:", res);
  }

  console.log("\n=== 4. Consultando 'administrators' ===");
  const { data: admins, error: aErr } = await supabase.from("administrators").select("*");
  console.log("Admins error:", aErr?.message);
  console.log("Admins rows:", admins);

  console.log("\n=== 5. Consultando 'profiles' ===");
  const { data: prof, error: pErr } = await supabase.from("profiles").select("*");
  console.log("Profiles error:", pErr?.message);
  console.log("Profiles rows:", prof);
}

inspectDb();
