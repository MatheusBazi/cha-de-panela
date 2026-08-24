"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

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

interface UserReservation {
  id: string;
  gift_id: string;
  status: string;
  reserved_at: string;
  cancel_until: string;
  cancelled_at?: string;
  gifts?: {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    image_url: string;
    external_url?: string;
    external_note?: string;
  };
}

export default function MyGiftsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reservations, setReservations] = useState<UserReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        try {
          const res = await fetch("/api/reservations/my");
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setReservations(json.data);
          }
        } catch (err) {
          console.error("Erro ao buscar presentes:", err);
        }
      }
      setLoading(false);
    }

    loadData();
  }, []);

  async function handleGoogleLogin() {
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/meus-presentes`,
      },
    });
  }

  async function handleCancelReservation(reservationId: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReservations((prev) =>
          prev.map((r) => (r.id === reservationId ? { ...r, status: "cancelled_by_user" } : r))
        );
        setCancellingId(null);
      } else {
        alert(data.message || "Não foi possível cancelar a reserva.");
      }
    } catch {
      alert("Erro de conexão ao cancelar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function canCancel(cancelUntilStr: string, status: string) {
    if (status !== "active") return false;
    const cancelUntil = new Date(cancelUntilStr).getTime();
    return Date.now() <= cancelUntil;
  }

  return (
    <div className="min-h-screen bg-[#F4EFE7] flex flex-col selection:bg-sage-200 text-[#493E33]">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 flex-1 w-full space-y-6 sm:space-y-8">
        {/* Header da Página */}
        <div className="text-center space-y-2 max-w-xl mx-auto px-2">
          <span className="text-xs uppercase tracking-widest text-[#73795B] font-medium">
            Área do Convidado
          </span>
          <h1 className="text-2xl sm:text-4xl font-serif font-light text-[#493E33] tracking-tight">
            Meus Presentes Escolhidos
          </h1>
          <p className="text-xs sm:text-sm text-[#6B5D4E] leading-relaxed">
            Aqui você acompanha os presentes que reservou para o nosso Chá de Panela.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3.5 max-w-2xl mx-auto">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] p-4 sm:p-6 animate-pulse flex gap-3.5"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#EDE6DA] rounded-[8px] flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-1/3 bg-[#EDE6DA] rounded" />
                  <div className="h-5 w-2/3 bg-[#EDE6DA] rounded" />
                  <div className="h-3 w-1/2 bg-[#EDE6DA] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="bg-[#FBF8F3] rounded-[16px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-soft">
            <div className="w-12 h-12 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center mx-auto text-xl">
              🌿
            </div>
            <h2 className="font-serif font-normal text-[#493E33] text-lg sm:text-xl">
              Identifique-se para ver seus presentes
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              Entre com sua conta Google para consultar a lista de presentes que você escolheu.
            </p>
            <button
              onClick={handleGoogleLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 min-h-[48px] px-6 py-3 rounded-[12px] bg-[#FFFDFA] hover:bg-[#EDE6DA] border border-[#C7BCAB] text-[#493E33] text-xs font-semibold shadow-soft transition-all"
            >
              <GoogleIcon className="w-4 h-4" />
              Entrar com Google
            </button>
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-[#FBF8F3] rounded-[16px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-soft">
            <div className="w-12 h-12 rounded-full bg-[#EDE6DA] text-[#8C8073] flex items-center justify-center mx-auto text-xl">
              🎁
            </div>
            <h2 className="font-serif font-normal text-[#493E33] text-lg sm:text-xl">
              Você ainda não escolheu nenhum presente
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              Nossa lista de presentes tem opções especiais para o nosso novo lar.
            </p>
            <Link
              href="/presentes"
              className="w-full sm:w-auto inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] text-xs font-semibold transition-all shadow-soft"
            >
              Explorar Lista de Presentes →
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5 max-w-3xl mx-auto">
            {reservations.map((res) => {
              const gift = res.gifts;
              const isActive = res.status === "active";
              const allowCancel = canCancel(res.cancel_until, res.status);
              const reservedDate = new Date(res.reserved_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={res.id}
                  className="bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] p-4 sm:p-6 shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4 transition-all"
                >
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    {gift?.image_url ? (
                      <img
                        src={gift.image_url}
                        alt={gift.name}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-[8px] object-cover border border-[#E2D8C9] bg-[#EDE6DA] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[8px] bg-[#EDE6DA] border border-[#E2D8C9] flex items-center justify-center text-xl text-[#73795B] flex-shrink-0">
                        🎁
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="text-[10px] sm:text-[11px] font-medium text-[#8C8073] uppercase tracking-wider block">
                        {gift?.category || "Chá de Panela"}
                      </span>
                      <h2 className="font-serif font-medium text-[#493E33] text-base sm:text-lg truncate">
                        {gift?.name || "Presente Especial"}
                      </h2>
                      <p className="text-[11px] text-[#6B5D4E]">
                        Reservado em: {reservedDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-[#E2D8C9]">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#EAEEE0] text-[#4E5B36] border border-[#969E78]/30">
                        ✓ Reservado por você
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#EDE6DA] text-[#8C8073]">
                        Reserva liberada
                      </span>
                    )}

                    {allowCancel && (
                      <button
                        onClick={() => setCancellingId(res.id)}
                        className="min-h-[44px] flex items-center text-xs text-[#8C8073] hover:text-[#A9573F] underline"
                      >
                        Desfazer reserva (10 min)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Cancelamento */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-8 max-w-md w-full shadow-floating space-y-4 safe-area-bottom">
            <h2 className="font-serif font-medium text-[#493E33] text-xl">
              Deseja liberar este presente?
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              O item voltará a ficar disponível para que outros convidados possam escolher.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setCancellingId(null)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] text-xs font-medium"
              >
                Manter reserva
              </button>
              <button
                onClick={() => handleCancelReservation(cancellingId)}
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
