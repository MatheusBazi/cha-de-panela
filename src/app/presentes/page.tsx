"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { REAL_GIFTS, normalizeCategory, type PublicGift } from "@/lib/catalog/fixtures";

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function LeafGiftIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#969E78" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="2"></rect>
      <path d="M12 8v13M3 13h18"></path>
      <path d="M12 8S9.5 3.5 7.5 4.5 7 8 12 8Zm0 0s2.5-4.5 4.5-3.5S17 8 12 8Z"></path>
    </svg>
  );
}

export default function CatalogPage() {
  const [gifts, setGifts] = useState<PublicGift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");

  async function fetchGifts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gifts");
      if (!res.ok) throw new Error(`Falha ao obter lista (HTTP ${res.status})`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setGifts(
          json.data.map((g: PublicGift) => ({
            ...g,
            category: normalizeCategory(g.category),
          }))
        );
      } else {
        setGifts(
          REAL_GIFTS.map((g) => ({
            ...g,
            category: normalizeCategory(g.category),
          }))
        );
      }
    } catch {
      setGifts(
        REAL_GIFTS.map((g) => ({
          ...g,
          category: normalizeCategory(g.category),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGifts();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    gifts.forEach((g) => {
      const cat = normalizeCategory(g.category);
      if (cat) set.add(cat);
    });
    return ["Todos", ...Array.from(set).sort()];
  }, [gifts]);

  const filteredGifts = useMemo(() => {
    return gifts.filter((gift) => {
      const matchesCategory =
        selectedCategory === "Todos" || gift.category === selectedCategory;
      const matchesSearch =
        searchTerm.trim() === "" ||
        gift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gift.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [gifts, selectedCategory, searchTerm]);

  return (
    <div className="min-h-screen bg-[#F4EFE7] flex flex-col selection:bg-sage-200 text-[#493E33]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 flex-1 w-full space-y-6 sm:space-y-8">
        {/* Cabeçalho Editorial do Catálogo */}
        <header className="space-y-2.5 text-center max-w-2xl mx-auto px-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAEEE0] border border-[#969E78]/30 text-[#5F6549] text-xs uppercase tracking-widest font-medium">
            Débora &amp; Matheus
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-light text-[#493E33] tracking-tight">
            Lista de Presentes
          </h1>
          <p className="text-xs sm:text-sm text-[#6B5D4E] leading-relaxed">
            Escolha com carinho os itens que farão parte do nosso novo lar. Ao selecionar um presente, ele será reservado exclusivamente em seu nome.
          </p>
        </header>

        {/* Barra de Busca e Filtros Móveis */}
        <div className="space-y-3.5 sticky top-16 sm:static z-20 bg-[#F4EFE7]/95 backdrop-blur-md pt-2 pb-1 sm:p-0">
          {/* Campo de Busca (Text size 16px para evitar auto-zoom no iOS) */}
          <div className="relative max-w-md mx-auto">
            <label htmlFor="catalog-search" className="sr-only">
              Buscar presente
            </label>
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C8073]">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              id="catalog-search"
              type="text"
              placeholder="Buscar presentes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-[#FFFDFA] border border-[#C7BCAB] rounded-[10px] text-[16px] text-[#493E33] placeholder-[#8C8073] focus:border-[#73795B] focus:outline-none transition-colors shadow-soft min-h-[48px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 w-11 h-full flex items-center justify-center text-xs text-[#8C8073] hover:text-[#493E33]"
                aria-label="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          {/* Faixa Horizontal Rolável de Filtros de Categoria */}
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <nav
              aria-label="Filtros de Categoria"
              className="flex items-center gap-2 min-w-max pb-1 sm:justify-center sm:flex-wrap"
            >
              {categories.map((category) => {
                const isActive = selectedCategory === category;
                const count =
                  category === "Todos"
                    ? gifts.length
                    : gifts.filter((g) => g.category === category).length;

                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    aria-pressed={isActive}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-[8px] text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                      isActive
                        ? "bg-[#6B7154] text-[#FBF8F3] shadow-soft"
                        : "bg-[#FBF8F3] text-[#6B5D4E] border border-[#E2D8C9] hover:bg-[#EDEFE4] active:bg-[#EDE6DA]"
                    }`}
                  >
                    <span>{category}</span>
                    <span
                      className={`text-[11px] ${
                        isActive ? "text-[#FBF8F3]/80" : "text-[#8C8073]"
                      }`}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Estado de Erro */}
        {error && (
          <div className="bg-[#F5E4DE] border border-[#A9573F]/30 p-5 rounded-[12px] text-center max-w-md mx-auto space-y-3">
            <p className="text-xs sm:text-sm font-medium text-[#8C4832]">{error}</p>
            <button
              onClick={fetchGifts}
              className="min-h-[44px] px-4 py-2 bg-[#6B7154] text-[#FBF8F3] text-xs font-medium rounded-[8px] hover:bg-[#565B43]"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Estado de Carregamento (Skeletons Neutros) */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] p-4 space-y-3 animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#EDE6DA] rounded-[8px]" />
                <div className="h-4 bg-[#EDE6DA] rounded w-3/4" />
                <div className="h-3 bg-[#EDE6DA] rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Estado Vazio */}
        {!loading && !error && filteredGifts.length === 0 && (
          <div className="bg-[#FBF8F3] border border-[#E2D8C9] rounded-[16px] p-8 sm:p-12 text-center max-w-md mx-auto space-y-3.5 shadow-soft">
            <div className="w-12 h-12 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center mx-auto text-xl">
              🌿
            </div>
            <h2 className="font-serif font-normal text-lg sm:text-xl text-[#493E33]">
              Nenhum presente encontrado
            </h2>
            <p className="text-xs text-[#6B5D4E]">
              Tente selecionar outra categoria ou limpar o termo de busca.
            </p>
            <button
              onClick={() => {
                setSelectedCategory("Todos");
                setSearchTerm("");
              }}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-[#73795B] hover:text-[#493E33] underline"
            >
              Ver todos os presentes
            </button>
          </div>
        )}

        {/* Grade do Catálogo de Presentes (Mobile 1-col ou 2-col fluida) */}
        {!loading && !error && filteredGifts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6">
            {filteredGifts.map((gift) => (
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
                      <div className="flex flex-col items-center gap-1 text-[#8C8073]">
                        <LeafGiftIcon />
                        <span className="text-[11px] font-medium text-[#73795B]">Chá de Panela</span>
                      </div>
                    )}
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-[#FBF8F3]/90 text-[10px] font-medium text-[#6B5D4E] border border-[#E2D8C9]">
                      {gift.category}
                    </span>
                  </div>

                  <div className="p-4 space-y-1">
                    <h2 className="font-serif font-medium text-[#493E33] text-base group-hover:text-[#73795B] transition-colors line-clamp-1">
                      {gift.name}
                    </h2>
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

                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#73795B] group-hover:text-[#493E33] group-hover:translate-x-0.5 transition-all">
                    Detalhes →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
