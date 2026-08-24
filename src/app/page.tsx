"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { REAL_GIFTS, type PublicGift } from "@/lib/catalog/fixtures";
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

export default function HomePage() {
  const [featuredGifts, setFeaturedGifts] = useState<PublicGift[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    async function loadFeatured() {
      try {
        const res = await fetch("/api/gifts");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setFeaturedGifts(json.data.slice(0, 4));
        } else {
          setFeaturedGifts(REAL_GIFTS.slice(0, 4));
        }
      } catch {
        setFeaturedGifts(REAL_GIFTS.slice(0, 4));
      }
    }

    loadFeatured();
  }, []);

  async function handleGoogleLogin() {
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/presentes`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#F4EFE7] flex flex-col selection:bg-sage-200 text-[#493E33]">
      <Header />

      <main className="flex-1 space-y-12 sm:space-y-20 pb-16 sm:pb-20">
        {/* Hero Section Mobile-First */}
        <section className="relative pt-8 sm:pt-16 pb-8 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center space-y-5">
          {/* Folhagem Decorativa Suave */}
          <div className="absolute top-0 left-0 -translate-x-4 -translate-y-4 pointer-events-none opacity-30 hidden md:block">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <g stroke="#969E78" strokeWidth="1" strokeLinecap="round" fill="none">
                <path d="M8 8C28 22 46 44 58 72"></path>
                <ellipse cx="22" cy="20" rx="11" ry="6.5" transform="rotate(28 22 20)" fill="rgba(150,158,120,0.16)"></ellipse>
                <ellipse cx="34" cy="36" rx="12" ry="7" transform="rotate(35 34 36)" fill="rgba(150,158,120,0.12)"></ellipse>
                <ellipse cx="16" cy="34" rx="10" ry="6" transform="rotate(-14 16 34)" fill="rgba(150,158,120,0.10)"></ellipse>
              </g>
            </svg>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAEEE0] border border-[#969E78]/30 text-[#5F6549] text-xs uppercase tracking-widest font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21c0-5 3-9 8-10-1 6-4 9-8 10Z"></path>
              <path d="M12 21c0-5-3-9-8-10 1 6 4 9 8 10Z"></path>
              <path d="M12 21V9"></path>
            </svg>
            Chá de Panela
          </div>

          {/* Título Principal */}
          <h1 className="font-serif font-light text-4xl sm:text-6xl md:text-7xl text-[#493E33] tracking-tight leading-[1.08] break-words">
            Débora &amp; Matheus
          </h1>

          <p className="font-script text-2xl sm:text-3xl md:text-4xl text-[#73795B] leading-tight">
            um novo lar começa aqui
          </p>

          <p className="text-sm sm:text-base text-[#6B5D4E] max-w-md sm:max-w-xl mx-auto leading-relaxed px-2">
            Estamos muito felizes em celebrar este novo começo com as pessoas que mais amamos. Preparamos uma lista especial de presentes para a nossa casa.
          </p>

          {/* Ações Hero com Touch Targets Confortáveis */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm sm:max-w-none mx-auto">
            <Link
              href="/presentes"
              className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] active:bg-[#454935] text-[#FBF8F3] text-sm font-medium tracking-wide shadow-soft flex items-center justify-center transition-all"
            >
              Ver Lista de Presentes →
            </Link>
            {user ? (
              <Link
                href="/meus-presentes"
                className="w-full sm:w-auto min-h-[48px] px-6 py-3.5 rounded-[12px] bg-[#FBF8F3] hover:bg-[#EDE6DA] active:bg-[#E2D8C9] text-[#493E33] border border-[#C7BCAB] text-sm font-medium flex items-center justify-center transition-colors"
              >
                Meus Presentes Escolhidos
              </Link>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3.5 rounded-[12px] bg-[#FFFDFA] hover:bg-[#EDE6DA] active:bg-[#E2D8C9] text-[#493E33] border border-[#C7BCAB] text-sm font-medium flex items-center justify-center gap-2.5 transition-colors shadow-soft"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>Entrar com Google</span>
              </button>
            )}
          </div>
        </section>

        {/* Detalhes do Encontro */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#FBF8F3] rounded-[16px] sm:rounded-[20px] border border-[#E2D8C9] p-5 sm:p-8 md:p-10 shadow-soft space-y-6">
            <div className="text-center space-y-1">
              <span className="text-xs uppercase tracking-widest text-[#73795B] font-medium">
                Encontro Especial
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-normal text-[#493E33]">
                Detalhes do Chá de Panela
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pt-2 text-center">
              {/* Data */}
              <div className="p-4 sm:p-5 bg-[#FFFDFA] rounded-[12px] border border-[#E2D8C9] space-y-1.5 flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-0">
                <div className="w-10 h-10 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="13" rx="3"></rect>
                    <path d="M16 2v4M8 2v4M3 10h18"></path>
                  </svg>
                </div>
                <div className="text-left sm:text-center flex-1">
                  <span className="font-medium text-[11px] text-[#8C8073] uppercase tracking-wider block">Data</span>
                  <p className="font-serif font-medium text-[#493E33] text-base sm:text-lg">21 de novembro de 2026</p>
                </div>
              </div>

              {/* Horário */}
              <div className="p-4 sm:p-5 bg-[#FFFDFA] rounded-[12px] border border-[#E2D8C9] space-y-1.5 flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-0">
                <div className="w-10 h-10 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 7v5l3 2"></path>
                  </svg>
                </div>
                <div className="text-left sm:text-center flex-1">
                  <span className="font-medium text-[11px] text-[#8C8073] uppercase tracking-wider block">Horário</span>
                  <p className="font-serif font-medium text-[#493E33] text-base sm:text-lg">15:00</p>
                </div>
              </div>

              {/* Local */}
              <div className="p-4 sm:p-5 bg-[#FFFDFA] rounded-[12px] border border-[#E2D8C9] space-y-1.5 flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-0">
                <div className="w-10 h-10 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                <div className="text-left sm:text-center flex-1">
                  <span className="font-medium text-[11px] text-[#8C8073] uppercase tracking-wider block">Local</span>
                  <p className="font-serif font-medium text-[#493E33] text-base sm:text-lg">Local em breve</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Destaque Afetivo */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#E8DED0] rounded-[16px] sm:rounded-[20px] border border-[#D9CDBA] p-6 sm:p-10 text-center space-y-2.5">
            <span className="font-script text-2xl sm:text-3xl text-[#73795B] block">com carinho</span>
            <h3 className="font-serif font-normal text-xl sm:text-2xl text-[#493E33]">
              Venha celebrar conosco
            </h3>
            <p className="text-xs sm:text-sm text-[#6B5D4E] max-w-md mx-auto leading-relaxed">
              O que mais valorizamos é o carinho, a presença e a amizade de cada um de vocês nesta nova etapa das nossas vidas.
            </p>
          </div>
        </section>

        {/* Prévia de Presentes */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 border-b border-[#E2D8C9] pb-3">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#73795B] font-medium">
                Sugestões da Lista
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#493E33]">
                Alguns dos Nossos Presentes
              </h2>
            </div>
            <Link
              href="/presentes"
              className="text-xs font-semibold text-[#73795B] hover:text-[#565B43] underline underline-offset-4 min-h-[38px] flex items-center"
            >
              Ver todos os 69 presentes →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredGifts.map((gift) => (
              <Link
                key={gift.id}
                href={`/presentes/${gift.slug}`}
                className="group bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 active:bg-[#EDE6DA]"
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EDE6DA] flex items-center justify-center">
                    {gift.image_url ? (
                      <img
                        src={gift.image_url}
                        alt={gift.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-[#8C8073]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#969E78" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="8" width="18" height="13" rx="2"></rect>
                          <path d="M12 8v13M3 13h18"></path>
                        </svg>
                        <span className="text-[11px] font-medium text-[#73795B]">Chá de Panela</span>
                      </div>
                    )}
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-[#FBF8F3]/90 text-[10px] font-medium text-[#6B5D4E] border border-[#E2D8C9]">
                      {gift.category}
                    </span>
                  </div>

                  <div className="p-4 space-y-1">
                    <h3 className="font-serif font-medium text-[#493E33] text-base group-hover:text-[#73795B] transition-colors line-clamp-1">
                      {gift.name}
                    </h3>
                    <p className="text-xs text-[#6B5D4E] line-clamp-2 leading-relaxed">
                      {gift.description}
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-[#E2D8C9]/60 mt-2 flex items-center justify-between min-h-[44px]">
                  {gift.is_reserved ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE6DA] text-[#8C8073]">
                      ✓ Já escolhido
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EAEEE0] text-[#4E5B36]">
                      Disponível
                    </span>
                  )}
                  <span className="text-xs font-medium text-[#73795B] group-hover:translate-x-0.5 transition-transform">
                    Ver detalhes →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
