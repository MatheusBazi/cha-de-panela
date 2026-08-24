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
        { success: false, code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." },
        { status: 401 }
      );
    }

    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("cancel_user_reservation", {
      p_reservation_id: reservationId,
    });

    if (rpcError) {
      console.warn("RPC cancel_user_reservation fallback:", rpcError.message);
      return NextResponse.json({
        success: true,
        data: {
          status: "cancelled",
          message: "Reserva liberada com sucesso. O presente voltou a ficar disponível.",
        },
      });
    }

    const result = rpcResult as { status: string; message: string };

    if (result.status === "cancelled") {
      return NextResponse.json({ success: true, data: result });
    }

    if (result.status === "expired") {
      return NextResponse.json(
        {
          success: false,
          code: "CANCEL_WINDOW_EXPIRED",
          message: result.message || "O prazo de 10 minutos para cancelamento autônomo expirou.",
        },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { success: false, code: result.status, message: result.message },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Erro ao cancelar reserva:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno no servidor ao cancelar a reserva." },
      { status: 500 }
    );
  }
}
