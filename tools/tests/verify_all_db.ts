import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lmkasxsmsgdfqcbpdlzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta2FzeHNtc2dkZnFjYnBkbHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTgyMTAsImV4cCI6MjEwMzA5NDIxMH0.9IcXF7jU3UBiX88U-dcRQRJC3ZtIuy9ftGtZ8X2sxIg";

async function verifyAll() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("==========================================");
  console.log("🔍 AUDITORIA COMPLETA DO BANCO SUPABASE");
  console.log("==========================================");

  // 1. Verificar todos os presentes na tabela 'gifts'
  const { data: gifts, error: giftsErr } = await supabase.from("gifts").select("id, slug, name, is_active");
  console.log(`\n1. Total de presentes cadastrados em 'gifts': ${gifts?.length || 0}`);
  if (giftsErr) console.error("Erro em gifts:", giftsErr);

  // 2. Verificar presentes reservados em 'public_gifts_view'
  const { data: viewGifts, error: viewErr } = await supabase.from("public_gifts_view").select("id, slug, name, is_reserved");
  const reservedInView = viewGifts?.filter((g: any) => g.is_reserved) || [];
  console.log(`\n2. Presentes com is_reserved = true em 'public_gifts_view': ${reservedInView.length}`);
  reservedInView.forEach((g: any) => {
    console.log(`   - ${g.name} (id: ${g.id}, slug: ${g.slug})`);
  });

  // 3. Testar a RPC get_public_gifts()
  const { data: rpcGifts, error: rpcGiftsErr } = await supabase.rpc("get_public_gifts");
  console.log(`\n3. RPC 'get_public_gifts' existe e responde? ${rpcGifts ? "SIM (" + rpcGifts.length + " itens)" : "NÃO (" + rpcGiftsErr?.message + ")"}`);

  // 4. Testar a RPC reserve_gift_atomic()
  const { data: rpcReserve, error: rpcReserveErr } = await supabase.rpc("reserve_gift_atomic", {
    p_gift_id: "324e4452-45b9-47ae-ab12-93f7ec64e29b", // Liquidificador
    p_idempotency_key: "test-verify-1",
  });
  console.log(`\n4. RPC 'reserve_gift_atomic' responde com authentication_required para anônimo? ${rpcReserve?.status === "authentication_required" ? "SIM" : JSON.stringify({ rpcReserve, rpcReserveErr })}`);

  // 5. Verificar tabela 'administrators'
  const { data: admins, error: adminsErr } = await supabase.from("administrators").select("*");
  console.log(`\n5. Tabela 'administrators' acessível? ${admins !== null ? "SIM (" + admins.length + " admins)" : "NÃO (" + adminsErr?.message + ")"}`);

  console.log("\n==========================================");
}

verifyAll();
