import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_WIDTH = 800;
const WEBP_QUALITY = 75;
const MAX_CACHE_ENTRIES = 200;

// Cache em memória das fotos já reduzidas (evita reprocessar a cada visita).
const processed = new Map<string, { buf: Buffer; etag: string }>();

const IMMUTABLE = "public, max-age=31536000, immutable";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("public_gifts_view")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    const imageUrl = (data as { image_url?: string | null } | null)?.image_url;
    if (error || !imageUrl) {
      return new NextResponse("Imagem não encontrada", { status: 404 });
    }

    // Foto hospedada fora (ex.: Unsplash): só redireciona.
    if (!imageUrl.startsWith("data:")) {
      return NextResponse.redirect(imageUrl, 302);
    }

    const version = createHash("md5").update(imageUrl).digest("hex").slice(0, 10);
    const cacheKey = `${id}:${version}`;

    let entry = processed.get(cacheKey);
    if (!entry) {
      const base64 = imageUrl.slice(imageUrl.indexOf(",") + 1);
      const original = Buffer.from(base64, "base64");
      const buf = await sharp(original)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      entry = { buf, etag: `"${version}"` };
      if (processed.size >= MAX_CACHE_ENTRIES) {
        const first = processed.keys().next().value;
        if (first) processed.delete(first);
      }
      processed.set(cacheKey, entry);
    }

    if (request.headers.get("if-none-match") === entry.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: entry.etag, "Cache-Control": IMMUTABLE },
      });
    }

    return new NextResponse(new Uint8Array(entry.buf), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(entry.buf.length),
        // A URL já traz ?v=<hash>; se a foto mudar, o endereço muda.
        "Cache-Control": IMMUTABLE,
        ETag: entry.etag,
      },
    });
  } catch (err) {
    console.error("Erro ao servir imagem do presente:", err);
    return new NextResponse("Erro ao carregar imagem", { status: 500 });
  }
}
