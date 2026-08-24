import { NextResponse } from "next/server";

export async function GET() {
  const startTime = Date.now();
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  const isPlaceholderUrl = !rawUrl || rawUrl.includes("placeholder-project") || rawUrl.includes("your-project");
  const isPlaceholderKey = !rawAnonKey || rawAnonKey.includes("placeholder") || rawAnonKey.includes("your-anon-key");

  const usingPlaceholder = isPlaceholderUrl || isPlaceholderKey;
  const environmentConfigured = Boolean(rawUrl && rawAnonKey && !usingPlaceholder);

  let remoteConnectionVerified = false;
  let remoteHandshakeStatus: "verified" | "network_error" | "auth_error" | "skipped_placeholder" = "skipped_placeholder";
  let diagnosticMessage = "";
  let httpStatusCode = 0;

  if (environmentConfigured) {
    try {
      // Handshake não destrutivo com o endpoint público de auth settings do Supabase
      const authSettingsUrl = `${rawUrl.replace(/\/+$/, "")}/auth/v1/settings`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(authSettingsUrl, {
        method: "GET",
        headers: {
          "apikey": rawAnonKey,
          "Authorization": `Bearer ${rawAnonKey}`,
        },
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);
      httpStatusCode = response.status;

      if (response.ok) {
        // HTTP 200: Supabase remoto acessível e chave anon aceita
        remoteConnectionVerified = true;
        remoteHandshakeStatus = "verified";
        diagnosticMessage = "Conexão remota com Supabase verificada com sucesso. Projeto acessível e credencial pública aceita.";
      } else if (response.status === 401 || response.status === 403) {
        remoteConnectionVerified = false;
        remoteHandshakeStatus = "auth_error";
        diagnosticMessage = `Supabase remoto alcançado, mas a credencial pública foi rejeitada (HTTP ${response.status}).`;
      } else {
        remoteConnectionVerified = false;
        remoteHandshakeStatus = "auth_error";
        diagnosticMessage = `Supabase remoto respondeu com status inesperado (HTTP ${response.status}).`;
      }
    } catch (err: unknown) {
      remoteConnectionVerified = false;
      remoteHandshakeStatus = "network_error";
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido de conexão";
      diagnosticMessage = `Falha de rede ao conectar com Supabase remoto: ${errorMsg}`;
    }
  } else {
    diagnosticMessage = "Variáveis de ambiente ausentes ou utilizando placeholders. Handshake remoto não executado.";
  }

  const responseTimeMs = Date.now() - startTime;

  return NextResponse.json({
    status: remoteConnectionVerified ? "ok" : environmentConfigured ? "degraded" : "pending_configuration",
    phase: "Fase 1 — Link & Infraestrutura Mínima",
    timestamp: new Date().toISOString(),
    checks: {
      environmentConfigured,
      usingPlaceholder,
      remoteConnectionVerified,
    },
    handshake: {
      status: remoteHandshakeStatus,
      message: diagnosticMessage,
      httpStatus: httpStatusCode || null,
      responseTimeMs,
    },
    environment: {
      nodeVersion: process.version,
      nextJsAppRouter: true,
      hasSupabaseUrl: Boolean(rawUrl),
      hasAnonKey: Boolean(rawAnonKey),
      hasServiceRoleKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
}
