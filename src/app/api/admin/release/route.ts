import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "deboragabrielepereira@gmail.com",
  "matheusbazi01@gmail.com",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservationId } = body;

    if (!reservationId || typeof reservationId !== "string") {
      return NextResponse.json(
        { success: false, error: "reservationId é obrigatório." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 401 }
      );
    }

    const email = user.email?.toLowerCase().trim() || "";
    const isAllowlisted = ADMIN_EMAILS.includes(email);

    // Auto-bootstrap: garante que o admin está na tabela administrators
    if (isAllowlisted) {
      try {
        await (supabase as any).from("administrators").upsert(
          {
            user_id: user.id,
            email: email,
            role: "owner",
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      } catch (upsertErr) {
        console.warn("Aviso ao auto-bootstrap admin:", upsertErr);
      }
    }

    // Verificar se é admin
    const { data: adminRecord } = await (supabase as any)
      .from("administrators")
      .select("user_id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const isAdmin = isAllowlisted || Boolean(adminRecord?.is_active);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, code: "forbidden", message: "Acesso administrativo necessário." },
        { status: 403 }
      );
    }

    // 1. Executar liberação via RPC
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("admin_release_reservation", {
      p_reservation_id: reservationId,
    });

    if (!rpcError && rpcResult?.status === "released") {
      return NextResponse.json({
        success: true,
        data: rpcResult,
        message: "Reserva liberada com sucesso pelo administrador.",
      });
    }

    // 2. Fallback direto de update no banco garantindo a liberação e checando retorno
    const { data: updatedRows, error: updateErr } = await (supabase as any)
      .from("reservations")
      .update({
        status: "released_by_admin",
        released_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select("id, status");

    if (updateErr) {
      console.error("Erro no update de liberação:", updateErr.message);
      return NextResponse.json(
        { success: false, error: updateErr.message },
        { status: 400 }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      if (rpcResult?.message) {
        return NextResponse.json(
          { success: false, error: rpcResult.message },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Não foi possível atualizar o registro no banco de dados." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        status: "released",
        message: "Reserva liberada com sucesso pelo administrador.",
      },
    });
  } catch (err: unknown) {
    console.error("Erro na liberação administrativa:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno no servidor ao liberar reserva." },
      { status: 500 }
    );
  }
}
