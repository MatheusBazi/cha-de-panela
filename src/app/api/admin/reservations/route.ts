import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "deboragabrielepereira@gmail.com",
  "matheusbazi01@gmail.com",
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // 1. Tentar primeiro via RPC com SECURITY DEFINER (imune a bloqueios de RLS)
    const { data: rpcRows, error: rpcErr } = await (supabase.rpc as any)("get_all_reservations_admin");

    if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
      const mapped = rpcRows.map((r: any) => ({
        id: r.id,
        gift_id: r.gift_id,
        user_id: r.user_id,
        status: r.status,
        reserved_at: r.reserved_at,
        cancel_until: r.cancel_until,
        cancelled_at: r.cancelled_at,
        released_at: r.released_at,
        gifts: {
          id: r.gift_id,
          name: r.gift_name,
          category: r.gift_category,
          image_url: r.gift_image_url,
        },
        profiles: {
          name: r.guest_name || "Convidado",
          email: r.guest_email || r.user_id,
        },
      }));

      return NextResponse.json({
        success: true,
        isAdmin: true,
        data: mapped,
      });
    }

    // 2. Fallback: consulta direta à tabela 'reservations'
    const { data: reservations, error: resError } = await (supabase as any)
      .from("reservations")
      .select(`
        id,
        gift_id,
        user_id,
        status,
        reserved_at,
        cancel_until,
        cancelled_at,
        released_at,
        gifts (
          id,
          slug,
          name,
          category,
          image_url
        )
      `)
      .order("reserved_at", { ascending: false });

    if (resError) {
      console.warn("Aviso ao buscar reservas:", resError.message);
    }

    const userIds = Array.from(new Set((reservations || []).map((r: any) => r.user_id).filter(Boolean)));
    let profilesMap: Record<string, { name: string; email: string }> = {};

    if (userIds.length > 0) {
      try {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);

        if (profiles) {
          profiles.forEach((p: any) => {
            profilesMap[p.id] = { name: p.name, email: p.email };
          });
        }
      } catch (profErr) {
        console.warn("Aviso ao buscar perfis:", profErr);
      }
    }

    const formatted = (reservations || []).map((r: any) => {
      const profile = profilesMap[r.user_id];
      return {
        ...r,
        profiles: profile || {
          name: "Convidado",
          email: r.user_id,
        },
      };
    });

    return NextResponse.json({
      success: true,
      isAdmin: true,
      data: formatted,
    });
  } catch (err: unknown) {
    console.error("Erro na rota /api/admin/reservations:", err);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados administrativos." },
      { status: 500 }
    );
  }
}
