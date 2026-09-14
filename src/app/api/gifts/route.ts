import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REAL_GIFTS, normalizeCategory, type PublicGift } from "@/lib/catalog/fixtures";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Consulta a RPC segura get_public_gifts() ou a view sanitizada public_gifts_view
    const { data: dbGifts, error } = await supabase
      .from("public_gifts_view")
      .select("id, slug, name, description, category, image_url, external_url, external_note, preferences, display_order, is_reserved");

    let rawGifts: PublicGift[] = [];

    if (error || !dbGifts || dbGifts.length === 0) {
      // Retorna a lista real de 69 presentes oficiais
      rawGifts = REAL_GIFTS;
    } else {
      rawGifts = dbGifts as PublicGift[];
    }

    // Normaliza as categorias (unificando Mesa e Servir + Café em Cozinha)
    const giftsToReturn = rawGifts.map((g) => ({
      ...g,
      category: normalizeCategory(g.category),
    }));

    // Ordenação determinística: display_order ASC, name ASC
    giftsToReturn.sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });

    const categories = Array.from(new Set(giftsToReturn.map((g) => g.category))).sort();

    const response = NextResponse.json({
      success: true,
      data: giftsToReturn,
      total: giftsToReturn.length,
      categories,
    });

    response.headers.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=59");
    return response;
  } catch (err: unknown) {
    console.error("Erro ao listar presentes públicos:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Não conseguimos carregar a lista de presentes no momento. Por favor, tente novamente.",
      },
      { status: 500 }
    );
  }
}
