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

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 401 }
      );
    }

    const email = user.email?.toLowerCase().trim() || "";
    const isAllowlisted = ADMIN_EMAILS.includes(email);

    // Auto-bootstrap: se for um dos e-mails autorizados, garante inserção em administrators
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
        console.warn("Aviso ao sincronizar administrador:", upsertErr);
      }
    }

    // Verificar se o usuário autenticado é um administrador ativo
    const { data: adminRecord } = await (supabase as any)
      .from("administrators")
      .select("user_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const isAdmin = isAllowlisted || Boolean(adminRecord?.is_active);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Acesso restrito aos noivos/administradores." },
        { status: 403 }
      );
    }

    // Consulta todas as reservas registradas
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
      console.error("Erro ao buscar reservas no admin:", resError.message);
      return NextResponse.json({
        success: true,
        isAdmin: true,
        data: [],
      });
    }

    // Buscar perfis para obter nomes e e-mails de quem reservou
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
