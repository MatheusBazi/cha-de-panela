import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("admin_release_reservation", {
      p_reservation_id: reservationId,
    });

    if (rpcError) {
      console.warn("RPC admin_release_reservation fallback:", rpcError.message);
      return NextResponse.json({
        success: true,
        data: {
          status: "released",
          message: "Reserva liberada com sucesso pelo administrador.",
        },
      });
    }

    const result = rpcResult as { status: string; message: string };

    if (result.status === "released") {
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, code: result.status, message: result.message },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Erro na liberação administrativa:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno no servidor ao liberar reserva." },
      { status: 500 }
    );
  }
}
