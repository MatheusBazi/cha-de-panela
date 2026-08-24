"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { REAL_GIFTS, type PublicGift } from "@/lib/catalog/fixtures";
import type { User } from "@supabase/supabase-js";

function HeartIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.2c0 2.8.7 5.5 1.9 7.9l3.7-2.9z" />
      <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z" />
    </svg>
  );
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function GiftDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const supabase = createClient();

  const [gift, setGift] = useState<PublicGift | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userReservation, setUserReservation] = useState<{ id: string; cancel_until: string } | null>(null);

  // Estados dos Modais e Mutação
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationStatus, setMutationStatus] = useState<"idle" | "success" | "conflict" | "error" | "reconciling">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      try {
        const res = await fetch("/api/gifts");
        const json = await res.json();
        const found = (json.data as PublicGift[])?.find((g) => g.slug === slug);
        if (found) {
          setGift(found);

          if (user) {
            const { data: userRes } = await supabase
              .from("reservations")
              .select("id, cancel_until, status")
              .eq("gift_id", found.id)
              .eq("user_id", user.id)
              .eq("status", "active")
              .maybeSingle();

            if (userRes) {
              setUserReservation(userRes);
            }
          }
        } else {
          const localFound = REAL_GIFTS.find((g) => g.slug === slug) || null;
          setGift(localFound);
        }
      } catch {
        const localFound = REAL_GIFTS.find((g) => g.slug === slug) || null;
        setGift(localFound);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [slug]);

  async function handleGoogleLogin() {
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/presentes/${slug}`,
      },
    });
  }

  async function handleConfirmReservation() {
    if (!gift) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = `idemp-${gift.id}-${user?.id || "guest"}-${Date.now()}`;

    try {
      const response = await fetch("/api/reservations/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId: gift.id,
          idempotencyKey,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMutationStatus("success");
        setGift((prev) => (prev ? { ...prev, is_reserved: true } : prev));
        setUserReservation({
          id: data.data?.reservation_id || "res-new",
          cancel_until: data.data?.cancel_until || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
      } else if (response.status === 409) {
        setMutationStatus("conflict");
        setGift((prev) => (prev ? { ...prev, is_reserved: true } : prev));
      } else if (response.status === 401) {
        handleGoogleLogin();
      } else {
        setMutationStatus("error");
        setErrorMessage(data.message || "Não foi possível confirmar a reserva. Tente novamente.");
      }
    } catch {
      // Reconciliação amigável em caso de instabilidade móvel (network_uncertain)
      setMutationStatus("reconciling");
      setErrorMessage("Estamos confirmando o status da sua reserva com nossa base. Por favor, aguarde alguns instantes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelReservation() {
    if (!userReservation) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: userReservation.id }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsCancelModalOpen(false);
        setUserReservation(null);
        setGift((prev) => (prev ? { ...prev, is_reserved: false } : prev));
      } else {
        alert(data.message || "Não foi possível cancelar a reserva.");
      }
    } catch {
      alert("Erro de conexão ao cancelar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4EFE7] flex flex-col">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-12 w-full animate-pulse space-y-4">
          <div className="h-5 w-28 bg-[#EDE6DA] rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-[4/3] bg-[#EDE6DA] rounded-[16px]" />
            <div className="space-y-3">
              <div className="h-4 w-20 bg-[#EDE6DA] rounded" />
              <div className="h-7 w-3/4 bg-[#EDE6DA] rounded" />
              <div className="h-16 w-full bg-[#EDE6DA] rounded" />
              <div className="h-12 w-full bg-[#EDE6DA] rounded-[12px]" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="min-h-screen bg-[#F4EFE7] flex flex-col">
        <Header />
        <main className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#EDE6DA] text-[#8C8073] flex items-center justify-center mx-auto text-xl">
            🌿
          </div>
          <h1 className="font-serif font-medium text-[#493E33] text-xl sm:text-2xl">
            Presente não encontrado
          </h1>
          <p className="text-xs text-[#6B5D4E]">
            O item que você está procurando não existe ou foi desativado.
          </p>
          <Link
            href="/presentes"
            className="inline-block min-h-[44px] px-6 py-3 rounded-[12px] bg-[#6B7154] text-[#FBF8F3] text-xs font-medium"
          >
            Voltar para a Lista de Presentes
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const isReservedByMe = Boolean(userReservation);
  const isReservedByOther = gift.is_reserved && !isReservedByMe;

  return (
    <div className="min-h-screen bg-[#F4EFE7] flex flex-col selection:bg-sage-200 text-[#493E33] pb-24 sm:pb-0">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 w-full">
        {/* Breadcrumb Editorial */}
        <nav className="flex items-center gap-1.5 text-xs text-[#8C8073] mb-5 sm:mb-8 overflow-hidden text-ellipsis whitespace-nowrap">
          <Link href="/" className="hover:text-[#493E33] transition-colors flex-shrink-0">
            Início
          </Link>
          <span>/</span>
          <Link href="/presentes" className="hover:text-[#493E33] transition-colors flex-shrink-0">
            Presentes
          </Link>
          <span>/</span>
          <span className="text-[#493E33] font-medium truncate">
            {gift.name}
          </span>
        </nav>

        {/* Card Principal do Produto */}
        <div className="bg-[#FBF8F3] rounded-[16px] sm:rounded-[20px] border border-[#E2D8C9] p-5 sm:p-8 md:p-10 shadow-soft grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 items-start">
          {/* Imagem do Presente / Placeholder Elegante */}
          <div className="relative aspect-[4/3] w-full rounded-[12px] overflow-hidden bg-[#EDE6DA] border border-[#E2D8C9] flex items-center justify-center">
            {gift.image_url ? (
              <img
                src={gift.image_url}
                alt={gift.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#8C8073]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#969E78" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="8" width="18" height="13" rx="2"></rect>
                  <path d="M12 8v13M3 13h18"></path>
                  <path d="M12 8S9.5 3.5 7.5 4.5 7 8 12 8Zm0 0s2.5-4.5 4.5-3.5S17 8 12 8Z"></path>
                </svg>
                <span className="text-xs font-medium text-[#73795B]">Chá de Panela</span>
              </div>
            )}
            <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-md bg-[#FBF8F3]/90 text-[10px] font-medium text-[#6B5D4E] border border-[#E2D8C9]">
              {gift.category}
            </span>
          </div>

          {/* Detalhes e Ações */}
          <div className="space-y-5 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#73795B] font-medium">
                    Chá de Panela
                  </span>
                  {gift.is_reserved ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE6DA] text-[#8C8073]">
                      ✓ Já escolhido
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EAEEE0] text-[#4E5B36]">
                      Disponível
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#493E33] tracking-tight">
                  {gift.name}
                </h1>
              </div>

              <p className="text-xs sm:text-sm text-[#6B5D4E] leading-relaxed">
                {gift.description}
              </p>

              {/* Preferências (Cor, Voltagem, etc.) */}
              {gift.preferences && Object.keys(gift.preferences).length > 0 && (
                <div className="p-3.5 bg-[#FFFDFA] rounded-[10px] border border-[#E2D8C9] space-y-1.5 text-xs">
                  <span className="font-semibold text-[#493E33] block">
                    Preferências dos Noivos:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(gift.preferences).map(([key, val]) => (
                      <span
                        key={key}
                        className="px-2.5 py-1 rounded-[6px] bg-[#EDE6DA] text-[#6B5D4E] font-medium text-[11px]"
                      >
                        {key}: <strong>{String(val)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Nota Adicional */}
              {gift.external_note && (
                <div className="p-3.5 bg-[#EDEFE4] border border-[#969E78]/35 rounded-[8px] text-xs text-[#3F4630] space-y-0.5">
                  <span className="font-semibold block">Dica com carinho:</span>
                  <p>{gift.external_note}</p>
                </div>
              )}

              {/* Link Externo Opcional com Aviso Transparente */}
              {gift.external_url && (
                <div className="pt-2 text-xs space-y-1 border-t border-[#E2D8C9]">
                  <a
                    href={gift.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#73795B] hover:text-[#565B43] font-semibold underline underline-offset-4 min-h-[38px]"
                  >
                    Ver onde encontrar este item ↗
                  </a>
                  <p className="text-[11px] text-[#8C8073]">
                    Esta é apenas uma referência. Você pode presentear adquirindo onde preferir.
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Action Area */}
            <div className="pt-4 border-t border-[#E2D8C9] hidden sm:block">
              {isReservedByMe ? (
                <div className="p-4 bg-[#EAEEE0] rounded-[12px] border border-[#969E78]/35 space-y-2">
                  <div className="flex items-center gap-2 text-[#4E5B36] font-medium text-sm">
                    <CheckCircleIcon className="w-5 h-5 text-[#7C8B5E]" />
                    Você escolheu este presente com muito carinho!
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <Link
                      href="/meus-presentes"
                      className="px-4 py-2 rounded-[8px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] text-xs font-medium"
                    >
                      Ver Meus Presentes
                    </Link>
                    <button
                      onClick={() => setIsCancelModalOpen(true)}
                      className="text-xs text-[#8C8073] hover:text-[#A9573F] underline"
                    >
                      Reservei por engano
                    </button>
                  </div>
                </div>
              ) : isReservedByOther ? (
                <div className="p-4 bg-[#EDE6DA] rounded-[12px] border border-[#E2D8C9] space-y-1.5">
                  <div className="flex items-center gap-2 text-[#493E33] font-medium text-sm">
                    <span>✓</span> Este presente já foi escolhido.
                  </div>
                  <Link
                    href="/presentes"
                    className="inline-block text-xs font-medium text-[#73795B] hover:text-[#493E33] underline"
                  >
                    Ver outros presentes disponíveis →
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMutationStatus("idle");
                    setIsReserveModalOpen(true);
                  }}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] font-medium text-sm shadow-soft hover:shadow-card transition-all flex items-center justify-center gap-2"
                >
                  <HeartIcon className="w-4 h-4" />
                  Quero presentear
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MOBILE STICKY BOTTOM ACTION BAR (Touch-target confortável respeitando safe area) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-[#FBF8F3]/95 backdrop-blur-md border-t border-[#E2D8C9] z-30 safe-area-bottom shadow-card">
        {isReservedByMe ? (
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/meus-presentes"
              className="flex-1 min-h-[48px] px-4 rounded-[12px] bg-[#6B7154] text-[#FBF8F3] text-xs font-medium flex items-center justify-center"
            >
              Ver Meus Presentes
            </Link>
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="px-3 min-h-[48px] text-xs text-[#8C8073] hover:text-[#A9573F] underline"
            >
              Desfazer
            </button>
          </div>
        ) : isReservedByOther ? (
          <Link
            href="/presentes"
            className="w-full min-h-[48px] rounded-[12px] bg-[#EDE6DA] text-[#493E33] text-xs font-medium flex items-center justify-center"
          >
            Ver outros presentes disponíveis
          </Link>
        ) : (
          <button
            onClick={() => {
              setMutationStatus("idle");
              setIsReserveModalOpen(true);
            }}
            className="w-full min-h-[48px] rounded-[12px] bg-[#6B7154] active:bg-[#565B43] text-[#FBF8F3] font-medium text-sm shadow-soft flex items-center justify-center gap-2"
          >
            <HeartIcon className="w-4 h-4" />
            Quero presentear
          </button>
        )}
      </div>

      {/* Modal de Confirmação Responsivo (Bottom-sheet no mobile / Dialog no desktop) */}
      {isReserveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-8 max-w-md w-full shadow-floating space-y-5 max-h-[90vh] overflow-y-auto safe-area-bottom animate-in slide-in-from-bottom sm:slide-in-from-top-2 duration-200">
            {mutationStatus === "success" ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center mx-auto text-2xl font-bold">
                  💚
                </div>
                <h2 className="font-serif font-medium text-[#493E33] text-2xl">
                  Presente reservado!
                </h2>
                <p className="text-xs text-[#6B5D4E] leading-relaxed">
                  Muito obrigado por nos presentear com <strong>{gift.name}</strong>. Seu gesto enche nosso coração de alegria!
                </p>
                <div className="flex flex-col gap-2.5 pt-2">
                  <Link
                    href="/meus-presentes"
                    className="w-full min-h-[48px] rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] text-xs font-semibold flex items-center justify-center transition-colors shadow-soft"
                  >
                    Ver Meus Presentes
                  </Link>
                  <Link
                    href="/presentes"
                    className="w-full min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] text-xs font-medium flex items-center justify-center transition-colors"
                  >
                    Continuar escolhendo presentes
                  </Link>
                </div>
              </div>
            ) : mutationStatus === "conflict" ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-[#EDE6DA] text-[#8C8073] flex items-center justify-center mx-auto text-xl">
                  ⌛
                </div>
                <h2 className="font-serif font-medium text-[#493E33] text-xl">
                  Este presente acabou de ser escolhido
                </h2>
                <p className="text-xs text-[#6B5D4E] leading-relaxed">
                  Outro convidado confirmou a reserva deste presente instantes antes. Que tal escolher outro item especial?
                </p>
                <div className="pt-2">
                  <Link
                    href="/presentes"
                    className="w-full min-h-[48px] rounded-[12px] bg-[#6B7154] text-[#FBF8F3] text-xs font-semibold flex items-center justify-center shadow-soft"
                  >
                    Ver outros presentes disponíveis
                  </Link>
                </div>
              </div>
            ) : mutationStatus === "reconciling" ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-[#EDE6DA] text-[#73795B] flex items-center justify-center mx-auto text-xl animate-spin">
                  ⏳
                </div>
                <h2 className="font-serif font-medium text-[#493E33] text-xl">
                  Confirmando sua reserva...
                </h2>
                <p className="text-xs text-[#6B5D4E] leading-relaxed">
                  Estamos confirmando o que aconteceu com sua reserva em nossa base de dados.
                </p>
              </div>
            ) : !user ? (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center mx-auto text-xl">
                  🌿
                </div>
                <h2 className="font-serif font-medium text-[#493E33] text-xl">
                  Identificação do Convidado
                </h2>
                <p className="text-xs text-[#6B5D4E] leading-relaxed">
                  Para sabermos quem nos presenteou com <strong>{gift.name}</strong>, entre com sua conta Google.
                </p>
                <button
                  onClick={handleGoogleLogin}
                  className="w-full min-h-[48px] px-4 rounded-[12px] bg-[#FBF8F3] hover:bg-[#EDE6DA] border border-[#C7BCAB] text-[#493E33] text-xs font-semibold flex items-center justify-center gap-3 shadow-soft transition-all"
                >
                  <GoogleIcon className="w-4 h-4" />
                  Continuar com Google
                </button>
                <button
                  onClick={() => setIsReserveModalOpen(false)}
                  className="w-full min-h-[44px] text-xs text-[#8C8073] hover:text-[#493E33]"
                >
                  Voltar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs text-[#73795B] font-semibold uppercase tracking-wider">
                    Confirmação de Reserva
                  </span>
                  <h2 className="font-serif font-medium text-[#493E33] text-xl">
                    Deseja presentear com este item?
                  </h2>
                </div>

                <div className="p-3 bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] flex items-center gap-3">
                  {gift.image_url ? (
                    <img
                      src={gift.image_url}
                      alt={gift.name}
                      className="w-12 h-12 rounded-[8px] object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-[8px] bg-[#EDE6DA] flex items-center justify-center text-[#73795B] flex-shrink-0">
                      🎁
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-[#493E33] truncate">
                      {gift.name}
                    </p>
                    <p className="text-[11px] text-[#8C8073]">{gift.category}</p>
                  </div>
                </div>

                <p className="text-xs text-[#6B5D4E] leading-relaxed">
                  Ao confirmar, este presente será reservado em seu nome (<strong>{user.email}</strong>).
                </p>

                {errorMessage && (
                  <div className="p-3 bg-[#F5E4DE] text-[#8C4832] border border-[#A9573F]/30 rounded-[8px] text-xs">
                    {errorMessage}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setIsReserveModalOpen(false)}
                    disabled={isSubmitting}
                    className="w-1/2 min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] text-xs font-medium"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmReservation}
                    disabled={isSubmitting}
                    className="w-1/2 min-h-[48px] rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft"
                  >
                    {isSubmitting ? "Confirmando..." : "Confirmar reserva"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-8 max-w-md w-full shadow-floating space-y-4 safe-area-bottom">
            <h2 className="font-serif font-medium text-[#493E33] text-xl">
              Deseja liberar este presente?
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              Ao liberar, <strong>{gift.name}</strong> voltará a ficar disponível para que outros convidados possam escolher.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] text-xs font-medium"
              >
                Manter reserva
              </button>
              <button
                onClick={handleCancelReservation}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#A9573F] hover:bg-[#8C4832] text-white text-xs font-semibold disabled:opacity-50"
              >
                {isSubmitting ? "Liberando..." : "Liberar presente"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
