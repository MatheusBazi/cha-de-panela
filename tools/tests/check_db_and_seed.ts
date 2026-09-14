import { createClient } from "@supabase/supabase-js";
import { REAL_GIFTS } from "../../src/lib/catalog/fixtures";

const SUPABASE_URL = "https://lmkasxsmsgdfqcbpdlzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta2FzeHNtc2dkZnFjYnBkbHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTgyMTAsImV4cCI6MjEwMzA5NDIxMH0.9IcXF7jU3UBiX88U-dcRQRJC3ZtIuy9ftGtZ8X2sxIg";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("1. Testando consulta à tabela 'gifts'...");
  const { data: gifts, error: giftsError } = await supabase.from("gifts").select("*").limit(5);
  console.log("Resultado 'gifts':", { count: gifts?.length, error: giftsError?.message });

  console.log("\n2. Testando consulta à view 'public_gifts_view'...");
  const { data: viewGifts, error: viewError } = await supabase.from("public_gifts_view").select("*").limit(5);
  console.log("Resultado 'public_gifts_view':", { count: viewGifts?.length, error: viewError?.message });

  console.log("\n3. Testando consulta à tabela 'reservations'...");
  const { data: reservations, error: resError } = await supabase.from("reservations").select("*").limit(5);
  console.log("Resultado 'reservations':", { count: reservations?.length, error: resError?.message });

  console.log("\n4. Testando chamada à RPC 'reserve_gift_atomic' com UUID falso...");
  const { data: rpcData, error: rpcError } = await supabase.rpc("reserve_gift_atomic", {
    p_gift_id: "00000000-0000-0000-0000-000000000000",
    p_idempotency_key: "test-key-123",
  });
  console.log("Resultado RPC:", { rpcData, error: rpcError?.message });
}

main();
