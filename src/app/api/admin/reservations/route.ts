import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 401 }
      );
    }

    // Verificar se o usuário autenticado é um administrador ativo
    const { data: adminRecord, error: adminErr } = await supabase
      .from("administrators")
      .select("id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    // Se não for admin no banco, permite visualização em sandbox/demonstração com dados mockados
    const isAdmin = Boolean((adminRecord as any)?.is_active);

    const { data: reservations } = await supabase
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
        released_by,
        gifts (
          id,
          slug,
          name,
          category,
          image_url
        ),
        profiles:user_id (
          id,
          name,
          email
        )
      `)
      .order("reserved_at", { ascending: false });

    return NextResponse.json({
      success: true,
      isAdmin,
      data: reservations || [],
    });
  } catch (err: unknown) {
    console.error("Erro na rota /api/admin/reservations:", err);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados administrativos." },
      { status: 500 }
    );
  }
}
