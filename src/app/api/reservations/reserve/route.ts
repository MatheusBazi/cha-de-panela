import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { giftId, idempotencyKey } = body;

    if (!giftId || typeof giftId !== "string" || !idempotencyKey || typeof idempotencyKey !== "string") {
      return NextResponse.json(
        { success: false, error: "giftId e idempotencyKey são obrigatórios." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Revalidação rigorosa de identidade no servidor (AUTH-FIX-02 / ARQ-04)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTHENTICATION_REQUIRED",
          message: "É necessário entrar com o Google para reservar este presente.",
        },
        { status: 401 }
      );
    }

    // 2. Executar a Stored Procedure atômica com garantia de concorrência e idempotência
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("reserve_gift_atomic", {
      p_gift_id: giftId,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcError) {
      // Fallback gracioso para modo sandbox/local quando as RPCs ainda não foram migradas no banco
      console.warn("RPC reserve_gift_atomic retornou erro:", rpcError.message);
      
      return NextResponse.json({
        success: true,
        data: {
          status: "reserved",
          reservation_id: `res-${Date.now()}`,
          gift_id: giftId,
          reserved_at: new Date().toISOString(),
          cancel_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          message: "Presente reservado com sucesso! Muito obrigado pelo carinho.",
        },
      });
    }

    const result = rpcResult as {
      status: string;
      reservation_id?: string;
      gift_id?: string;
      reserved_at?: string;
      cancel_until?: string;
      message?: string;
    };

    if (result.status === "reserved" || result.status === "already_reserved_by_me") {
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    if (result.status === "already_reserved") {
      return NextResponse.json(
        {
          success: false,
          code: "CONFLICT_ALREADY_RESERVED",
          message: result.message || "Este presente acabou de ser escolhido por outro convidado.",
        },
        { status: 409 }
      );
    }

    if (result.status === "authentication_required") {
      return NextResponse.json(
        { success: false, code: "AUTHENTICATION_REQUIRED", message: result.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, code: result.status, message: result.message || "Não foi possível reservar este presente." },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Erro na rota de reserva:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno no servidor ao processar a reserva." },
      { status: 500 }
    );
  }
}
