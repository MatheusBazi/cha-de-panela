import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeCategory } from "@/lib/catalog/fixtures";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." },
        { status: 401 }
      );
    }

    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select(`
        id,
        gift_id,
        status,
        reserved_at,
        cancel_until,
        cancelled_at,
        gifts (
          id,
          slug,
          name,
          description,
          category,
          image_url,
          external_url,
          external_note,
          preferences
        )
      `)
      .eq("user_id", user.id)
      .order("reserved_at", { ascending: false });

    if (resError) {
      console.warn("Erro ao buscar reservas do usuário:", resError.message);
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const sanitizedReservations = (reservations || []).map((r: any) => ({
      ...r,
      gifts: r.gifts
        ? {
            ...r.gifts,
            category: normalizeCategory(r.gifts.category),
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: sanitizedReservations,
    });
  } catch (err: unknown) {
    console.error("Erro na rota /api/reservations/my:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
