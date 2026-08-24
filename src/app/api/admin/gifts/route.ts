import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Helper de validação de autorização administrativa no servidor
async function verifyAdminAuth() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, user: null, supabase, errorResponse: NextResponse.json({ success: false, error: "Autenticação necessária." }, { status: 401 }) };
  }

  const { data: adminRecord } = await (supabase as any)
    .from("administrators")
    .select("id, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const isOwnerEmail = user.email && ["deboragabrielepereira@gmail.com", "matheusbazi01@gmail.com"].includes(user.email.toLowerCase().trim());
  const isAuthorized = Boolean(adminRecord?.is_active || isOwnerEmail);

  if (!isAuthorized) {
    return { authorized: false, user, supabase, errorResponse: NextResponse.json({ success: false, error: "Acesso administrativo restrito." }, { status: 403 }) };
  }

  return { authorized: true, user, supabase, errorResponse: null };
}

// 1. GET: Listar todos os presentes para o painel admin (incluindo inativos)
export async function GET() {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return auth.errorResponse!;

  const { data: gifts, error } = await (auth.supabase as any)
    .from("gifts")
    .select("id, slug, name, description, category, image_url, external_url, external_note, preferences, display_order, is_active")
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: gifts || [] });
}

// 2. POST: Criar novo presente
export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await request.json();
    const { name, category, description, slug, image_url, external_url, external_note, preferences, display_order } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Nome do presente é obrigatório." }, { status: 400 });
    }
    if (!category || typeof category !== "string" || !category.trim()) {
      return NextResponse.json({ success: false, error: "Categoria é obrigatória." }, { status: 400 });
    }

    // Geração determinística de slug se não fornecido
    const normalizedSlug = (slug || name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data: newGift, error: insertError } = await (auth.supabase as any)
      .from("gifts")
      .insert({
        name: name.trim(),
        category: category.trim(),
        description: description?.trim() || "",
        slug: normalizedSlug,
        image_url: image_url?.trim() || null,
        external_url: external_url?.trim() || null,
        external_note: external_note?.trim() || null,
        preferences: preferences || null,
        display_order: typeof display_order === "number" && display_order >= 0 ? display_order : 99,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ success: false, error: "Já existe um presente com este identificador (slug duplicado)." }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: newGift });
  } catch {
    return NextResponse.json({ success: false, error: "Erro ao criar presente." }, { status: 500 });
  }
}

// 3. PUT: Editar presente existente
export async function PUT(request: NextRequest) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await request.json();
    const { id, name, category, description, slug, image_url, external_url, external_note, preferences, display_order } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "ID do presente é obrigatório." }, { status: 400 });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Nome do presente é obrigatório." }, { status: 400 });
    }

    const { data: updatedGift, error: updateError } = await (auth.supabase as any)
      .from("gifts")
      .update({
        name: name.trim(),
        category: category?.trim(),
        description: description?.trim() || "",
        slug: slug?.trim(),
        image_url: image_url?.trim() || null,
        external_url: external_url?.trim() || null,
        external_note: external_note?.trim() || null,
        preferences: preferences || null,
        display_order: typeof display_order === "number" && display_order >= 0 ? display_order : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: updatedGift });
  } catch {
    return NextResponse.json({ success: false, error: "Erro ao editar presente." }, { status: 500 });
  }
}

// 4. DELETE: Soft-delete / Desativação de presente (is_active = false)
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "ID do presente é obrigatório." }, { status: 400 });
    }

    const { error: deactivateError } = await (auth.supabase as any)
      .from("gifts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (deactivateError) {
      return NextResponse.json({ success: false, error: deactivateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Presente removido da lista pública com sucesso (histórico preservado)." });
  } catch {
    return NextResponse.json({ success: false, error: "Erro ao desativar presente." }, { status: 500 });
  }
}

// 5. PATCH: Reativação de presente (is_active = true)
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "ID do presente é obrigatório." }, { status: 400 });
    }

    const { error: reactivateError } = await (auth.supabase as any)
      .from("gifts")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (reactivateError) {
      return NextResponse.json({ success: false, error: reactivateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Presente reativado no catálogo com sucesso." });
  } catch {
    return NextResponse.json({ success: false, error: "Erro ao reativar presente." }, { status: 500 });
  }
}
