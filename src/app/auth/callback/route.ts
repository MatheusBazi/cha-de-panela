import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Allowlist oficial de bootstrap para administradores autorizados pelo CEO
const APPROVED_ADMIN_EMAILS = [
  "deboragabrielepereira@gmail.com",
  "matheusbazi01@gmail.com",
];

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Detecção robusta da origem pública em produção (Vercel / Reverse Proxy)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;

  // Tratamento rigoroso de erro do provedor (ex: usuário cancelou o consentimento Google)
  if (error) {
    console.warn("OAuth Callback Provider Error:", error, errorDescription);
    const sanitizedError = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(new URL(`/?auth_error=${sanitizedError}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", origin));
  }

  // Troca atômica de código por sessão no servidor
  const supabase = await createClient();
  const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Erro ao trocar código de autorização por sessão:", exchangeError.message);
    const sanitizedMsg = encodeURIComponent(exchangeError.message);
    return NextResponse.redirect(new URL(`/?auth_error=${sanitizedMsg}`, requestUrl.origin));
  }

  // BOOTSTRAP DE ADMINISTRADORES AUTORIZADOS
  // Se o e-mail do usuário autenticado estiver na allowlist, provisiona/confirma na tabela administrators
  const user = session?.user;
  if (user?.email && APPROVED_ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) {
    try {
      await (supabase as any).from("administrators").upsert(
        {
          user_id: user.id,
          email: user.email.toLowerCase().trim(),
          role: "owner",
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch (adminErr) {
      console.warn("Aviso no bootstrap administrativo:", adminErr);
    }
  }

  // PROTEÇÃO CONTRA OPEN REDIRECT (AUTH-08 e AUTH-09)
  let safeNext = "/";
  if (rawNext && typeof rawNext === "string") {
    const trimmed = rawNext.trim();
    if (
      trimmed.startsWith("/") &&
      !trimmed.startsWith("//") &&
      !trimmed.includes("://") &&
      !trimmed.includes("\\")
    ) {
      safeNext = trimmed;
    }
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
