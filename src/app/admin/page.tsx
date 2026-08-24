"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { REAL_GIFTS, type PublicGift } from "@/lib/catalog/fixtures";
import type { User } from "@supabase/supabase-js";

interface AdminReservation {
  id: string;
  gift_id: string;
  user_id: string;
  status: string;
  reserved_at: string;
  cancelled_at?: string;
  released_at?: string;
  gifts?: {
    id: string;
    slug?: string;
    name: string;
    category: string;
    image_url?: string;
  };
  profiles?: {
    id?: string;
    name: string;
    email: string;
  };
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"reservations" | "gifts">("reservations");
  const [reservationFilter, setReservationFilter] = useState<"active" | "all">("active");
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [gifts, setGifts] = useState<PublicGift[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais de Presentes
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<PublicGift | null>(null);
  const [deletingGift, setDeletingGift] = useState<PublicGift | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Cozinha");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formExternalUrl, setFormExternalUrl] = useState("");
  const [formExternalNote, setFormExternalNote] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Liberação de Reservas
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    try {
      const [resResponse, giftResponse] = await Promise.all([
        fetch("/api/admin/reservations", { cache: "no-store" }),
        fetch("/api/admin/gifts", { cache: "no-store" }),
      ]);

      if (resResponse.ok) {
        const resJson = await resResponse.json();
        if (resJson.success && Array.isArray(resJson.data)) {
          setReservations(resJson.data);
        }
      }

      if (giftResponse.ok) {
        const giftJson = await giftResponse.json();
        if (giftJson.success && Array.isArray(giftJson.data) && giftJson.data.length > 0) {
          setGifts(giftJson.data);
        } else {
          setGifts(REAL_GIFTS);
        }
      } else {
        setGifts(REAL_GIFTS);
      }
    } catch {
      setGifts(REAL_GIFTS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    const nextOrder = gifts.length > 0
      ? Math.max(...gifts.map((g) => g.display_order || 0)) + 1
      : 1;

    setEditingGift(null);
    setFormName("");
    setFormCategory("Cozinha");
    setFormDescription("");
    setFormImageUrl("");
    setFormExternalUrl("");
    setFormExternalNote("");
    setFormDisplayOrder(nextOrder);
    setErrorMessage(null);
    setIsGiftModalOpen(true);
  }

  function openEditModal(gift: PublicGift) {
    setEditingGift(gift);
    setFormName(gift.name);
    setFormCategory(gift.category);
    setFormDescription(gift.description || "");
    setFormImageUrl(gift.image_url || "");
    setFormExternalUrl(gift.external_url || "");
    setFormExternalNote(gift.external_note || "");
    setFormDisplayOrder(gift.display_order);
    setErrorMessage(null);
    setIsGiftModalOpen(true);
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert("A imagem selecionada é muito pesada. Escolha uma foto de até 4MB.");
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormImageUrl(result);
      setIsUploadingImage(false);
    };
    reader.onerror = () => {
      alert("Erro ao ler o arquivo de imagem.");
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveGift(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage("Nome do presente é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      id: editingGift?.id,
      name: formName.trim(),
      category: formCategory.trim(),
      description: formDescription.trim(),
      image_url: formImageUrl.trim() || null,
      external_url: formExternalUrl.trim() || null,
      external_note: formExternalNote.trim() || null,
      display_order: Number(formDisplayOrder),
    };

    try {
      const url = "/api/admin/gifts";
      const method = editingGift ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsGiftModalOpen(false);
        await loadData();
      } else {
        setErrorMessage(data.error || "Erro ao salvar presente.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao salvar presente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteGift(giftId: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: giftId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGifts((prev) => prev.filter((g) => g.id !== giftId));
        setDeletingGift(null);
        await loadData();
      } else {
        alert(data.error || "Erro ao excluir presente.");
      }
    } catch {
      alert("Erro de conexão ao excluir presente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReleaseReservation(reservationId: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Remove imediatamente da lista local
        setReservations((prev) =>
          prev.map((r) => (r.id === reservationId ? { ...r, status: "released_by_admin" } : r))
        );
        setReleasingId(null);
        await loadData();
      } else {
        alert(data.error || data.message || "Erro ao liberar reserva.");
      }
    } catch {
      alert("Erro de conexão ao liberar reserva.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeReservations = reservations.filter((r) => r.status === "active");
  const displayedReservations = reservationFilter === "active" ? activeReservations : reservations;

  return (
    <div className="min-h-screen bg-[#F4EFE7] flex flex-col selection:bg-sage-200 text-[#493E33]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-16 flex-1 w-full space-y-6 sm:space-y-8">
        {/* Header Administrativo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-[#E2D8C9]">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#73795B] font-medium">
              Painel de Gestão dos Noivos
            </span>
            <h1 className="text-xl sm:text-3xl font-serif font-medium text-[#493E33] tracking-tight">
              Acompanhamento de Reservas &amp; Catálogo
            </h1>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={openCreateModal}
              className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] text-xs font-semibold flex items-center justify-center transition-all shadow-soft"
            >
              + Novo Presente
            </button>
            <button
              onClick={loadData}
              className="min-h-[44px] px-4 py-2.5 rounded-[12px] bg-[#FBF8F3] hover:bg-[#EDE6DA] border border-[#E2D8C9] text-xs font-medium text-[#6B5D4E] flex items-center justify-center transition-colors"
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#FBF8F3] p-4 sm:p-5 rounded-[12px] border border-[#E2D8C9] space-y-1 shadow-soft">
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Reservas Ativas</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#6B7154]">{activeReservations.length}</p>
          </div>
          <div className="bg-[#FBF8F3] p-4 sm:p-5 rounded-[12px] border border-[#E2D8C9] space-y-1 shadow-soft">
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Total de Presentes</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#493E33]">{gifts.length}</p>
          </div>
          <div className="bg-[#FBF8F3] p-4 sm:p-5 rounded-[12px] border border-[#E2D8C9] space-y-1 shadow-soft">
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Itens Ativos</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#73795B]">{gifts.filter((g) => g.is_active !== false).length}</p>
          </div>
          <div className="bg-[#FBF8F3] p-4 sm:p-5 rounded-[12px] border border-[#E2D8C9] space-y-1 shadow-soft">
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Total Histórico Reservas</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#8C8073]">{reservations.length}</p>
          </div>
        </div>

        {/* Abas de Navegação Admin */}
        <div className="flex items-center gap-2 border-b border-[#E2D8C9] pb-2">
          <button
            onClick={() => setActiveTab("reservations")}
            className={`min-h-[44px] px-4 py-2 rounded-[8px] text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "reservations"
                ? "bg-[#6B7154] text-[#FBF8F3] shadow-soft"
                : "bg-transparent text-[#6B5D4E] hover:bg-[#EDE6DA]"
            }`}
          >
            <span>Itens Reservados</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "reservations" ? "bg-white/20 text-white" : "bg-[#EDE6DA] text-[#6B5D4E]"}`}>
              {activeReservations.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("gifts")}
            className={`min-h-[44px] px-4 py-2 rounded-[8px] text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "gifts"
                ? "bg-[#6B7154] text-[#FBF8F3] shadow-soft"
                : "bg-transparent text-[#6B5D4E] hover:bg-[#EDE6DA]"
            }`}
          >
            <span>Gerenciar Catálogo</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "gifts" ? "bg-white/20 text-white" : "bg-[#EDE6DA] text-[#6B5D4E]"}`}>
              {gifts.length}
            </span>
          </button>
        </div>

        {/* TAB 1: ITENS RESERVADOS (FILTRADO POR ATIVAS POR PADRÃO) */}
        {activeTab === "reservations" && (
          <div className="bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] overflow-hidden shadow-soft space-y-0">
            <div className="p-4 sm:p-5 border-b border-[#E2D8C9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif font-medium text-[#493E33] text-base">
                  {reservationFilter === "active" ? "Presentes com Reserva Ativa no Momento" : "Histórico Geral de Reservas"}
                </h2>
                <p className="text-xs text-[#8C8073]">
                  {reservationFilter === "active"
                    ? "Exibindo apenas presentes que estão atualmente reservados. Itens liberados voltam para a lista e saem desta tela."
                    : "Exibindo todas as reservas, incluindo as canceladas pelos convidados e liberadas pelos noivos."}
                </p>
              </div>

              {/* Toggle de Filtro Ativas vs Histórico */}
              <div className="flex items-center gap-1 bg-[#EDE6DA] p-1 rounded-[8px] self-start sm:self-auto flex-shrink-0">
                <button
                  onClick={() => setReservationFilter("active")}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all ${
                    reservationFilter === "active"
                      ? "bg-[#FFFDFA] text-[#493E33] shadow-xs font-semibold"
                      : "text-[#6B5D4E] hover:text-[#493E33]"
                  }`}
                >
                  Apenas Ativas ({activeReservations.length})
                </button>
                <button
                  onClick={() => setReservationFilter("all")}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all ${
                    reservationFilter === "all"
                      ? "bg-[#FFFDFA] text-[#493E33] shadow-xs font-semibold"
                      : "text-[#6B5D4E] hover:text-[#493E33]"
                  }`}
                >
                  Ver Histórico ({reservations.length})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#8C8073]">
                Carregando reservas...
              </div>
            ) : displayedReservations.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#8C8073] space-y-2">
                <p className="text-sm font-serif text-[#493E33]">
                  {reservationFilter === "active"
                    ? "Nenhum presente possui reserva ativa no momento."
                    : "Nenhum registro de reserva encontrado."}
                </p>
                <p>
                  {reservationFilter === "active"
                    ? "Todos os presentes estão livres e disponíveis para os convidados escolherem!"
                    : "Assim que um convidado escolher um presente, ele será registrado aqui."}
                </p>
              </div>
            ) : (
              <div>
                {/* Mobile View: Cards */}
                <div className="sm:hidden divide-y divide-[#E2D8C9]/60">
                  {displayedReservations.map((res) => {
                    const gift = res.gifts;
                    const profile = res.profiles;
                    const isActive = res.status === "active";
                    const isCancelled = res.status === "cancelled_by_user";
                    const dateStr = new Date(res.reserved_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div key={res.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-[#73795B] uppercase tracking-wider block font-medium">
                              {gift?.category || "Chá de Panela"}
                            </span>
                            <h3 className="font-serif font-medium text-base text-[#493E33]">
                              {gift?.name || "Presente"}
                            </h3>
                          </div>
                          {isActive ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAEEE0] text-[#4E5B36] flex-shrink-0">
                              Ativa
                            </span>
                          ) : isCancelled ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE6DA] text-[#8C8073] flex-shrink-0">
                              Cancelada Convidado
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#E8DED0] text-[#6B5D4E] flex-shrink-0">
                              Liberada Noivos
                            </span>
                          )}
                        </div>

                        <div className="p-3 bg-[#FFFDFA] rounded-[8px] border border-[#E2D8C9] space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#8C8073]">Convidado:</span>
                            <span className="font-semibold text-[#493E33]">{profile?.name || "Convidado"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#8C8073]">E-mail:</span>
                            <span className="text-[#6B5D4E]">{profile?.email || res.user_id}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#8C8073]">Data/Hora:</span>
                            <span className="text-[#8C8073] font-mono">{dateStr}</span>
                          </div>
                        </div>

                        {isActive && (
                          <div className="pt-1">
                            <button
                              onClick={() => setReleasingId(res.id)}
                              className="w-full min-h-[40px] bg-[#F5E4DE] text-[#8C4832] border border-[#A9573F]/30 rounded-[8px] font-medium text-xs flex items-center justify-center"
                            >
                              Liberar presente de volta para a lista
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EDE6DA] border-b border-[#E2D8C9] text-[#6B5D4E] uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Presente</th>
                        <th className="py-3 px-4">Convidado (Nome e E-mail)</th>
                        <th className="py-3 px-4">Data e Hora</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2D8C9]/60">
                      {displayedReservations.map((res) => {
                        const gift = res.gifts;
                        const profile = res.profiles;
                        const isActive = res.status === "active";
                        const isCancelled = res.status === "cancelled_by_user";
                        const dateStr = new Date(res.reserved_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <tr key={res.id} className="hover:bg-[#EDE6DA]/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-medium text-[#493E33]">{gift?.name || "Presente"}</div>
                              <div className="text-[11px] text-[#8C8073]">{gift?.category}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-[#493E33] font-semibold">{profile?.name || "Convidado"}</div>
                              <div className="text-[11px] text-[#73795B]">{profile?.email || res.user_id}</div>
                            </td>
                            <td className="py-3 px-4 text-[#6B5D4E] font-mono">{dateStr}</td>
                            <td className="py-3 px-4">
                              {isActive ? (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAEEE0] text-[#4E5B36]">
                                  Ativa
                                </span>
                              ) : isCancelled ? (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE6DA] text-[#8C8073]">
                                  Cancelada Convidado
                                </span>
                              ) : (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E8DED0] text-[#6B5D4E]">
                                  Liberada Noivos
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isActive && (
                                <button
                                  onClick={() => setReleasingId(res.id)}
                                  className="px-3 py-1 bg-[#F5E4DE] hover:bg-[#A9573F] hover:text-white border border-[#A9573F]/30 rounded-[6px] text-xs font-medium text-[#8C4832] transition-colors"
                                >
                                  Liberar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GERENCIAMENTO DE PRESENTES (CRUD COM EXCLUSÃO DEFINITIVA) */}
        {activeTab === "gifts" && (
          <div className="bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] overflow-hidden shadow-soft">
            <div className="p-4 sm:p-5 border-b border-[#E2D8C9]">
              <h2 className="font-serif font-medium text-[#493E33] text-base">
                Gerenciador de Presentes
              </h2>
              <p className="text-xs text-[#8C8073]">
                Adicione novos presentes, edite informações ou exclua itens da lista.
              </p>
            </div>

            {/* Mobile View: Cards */}
            <div className="sm:hidden divide-y divide-[#E2D8C9]/60">
              {gifts.map((gift) => (
                <div key={gift.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {gift.image_url ? (
                        <img
                          src={gift.image_url}
                          alt={gift.name}
                          className="w-12 h-12 rounded-[8px] object-cover bg-[#EDE6DA] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-[8px] bg-[#EDE6DA] flex items-center justify-center text-[#73795B] flex-shrink-0">
                          🎁
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[10px] text-[#8C8073] uppercase tracking-wider block">
                          #{gift.display_order} · {gift.category}
                        </span>
                        <h3 className="font-serif font-medium text-base text-[#493E33] truncate">
                          {gift.name}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openEditModal(gift)}
                      className="flex-1 min-h-[40px] bg-[#FFFDFA] border border-[#C7BCAB] rounded-[8px] text-xs font-medium text-[#493E33]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeletingGift(gift)}
                      className="flex-1 min-h-[40px] bg-[#F5E4DE] text-[#8C4832] border border-[#A9573F]/30 rounded-[8px] text-xs font-medium"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDE6DA] border-b border-[#E2D8C9] text-[#6B5D4E] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ordem</th>
                    <th className="py-3 px-4">Foto</th>
                    <th className="py-3 px-4">Presente</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D8C9]/60">
                  {gifts.map((gift) => (
                    <tr key={gift.id} className="hover:bg-[#EDE6DA]/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[#8C8073]">#{gift.display_order}</td>
                      <td className="py-3 px-4">
                        {gift.image_url ? (
                          <img
                            src={gift.image_url}
                            alt={gift.name}
                            className="w-10 h-10 rounded-[6px] object-cover bg-[#EDE6DA]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[6px] bg-[#EDE6DA] flex items-center justify-center text-xs text-[#73795B]">
                            🎁
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#493E33]">{gift.name}</div>
                        <div className="text-[11px] text-[#8C8073] line-clamp-1">{gift.description}</div>
                      </td>
                      <td className="py-3 px-4 text-[#6B5D4E]">{gift.category}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(gift)}
                          className="px-2.5 py-1 bg-[#FFFDFA] hover:bg-[#EDE6DA] border border-[#C7BCAB] rounded-[6px] text-xs font-medium text-[#493E33]"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDeletingGift(gift)}
                          className="px-2.5 py-1 bg-[#F5E4DE] hover:bg-[#A9573F] hover:text-white border border-[#A9573F]/30 rounded-[6px] text-xs font-medium text-[#8C4832] transition-colors"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PRESENTE */}
      {isGiftModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-5 sm:p-8 max-w-lg w-full shadow-floating space-y-4 max-h-[90vh] overflow-y-auto safe-area-bottom">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-medium text-[#493E33] text-xl sm:text-2xl">
                {editingGift ? "Editar Presente" : "Novo Presente para o Catálogo"}
              </h2>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#EAEEE0] text-[#5F6549] font-medium">
                Ordem #{formDisplayOrder} (automática)
              </span>
            </div>

            <form onSubmit={handleSaveGift} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-[#73795B] uppercase tracking-wider block">Nome do Presente *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Jogo de panelas"
                  className="w-full p-3 bg-[#FBF8F3] border border-[#C7BCAB] rounded-[8px] text-[16px] text-[#493E33] focus:border-[#73795B]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#73795B] uppercase tracking-wider block">Categoria *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-3 bg-[#FBF8F3] border border-[#C7BCAB] rounded-[8px] text-[16px] text-[#493E33]"
                >
                  <option value="Itens mais pedidos">Itens mais pedidos</option>
                  <option value="Cozinha">Cozinha</option>
                  <option value="Mesa e Servir">Mesa e Servir</option>
                  <option value="Café e Café da Manhã">Café e Café da Manhã</option>
                  <option value="Limpeza">Limpeza</option>
                  <option value="Quarto e Banheiro">Quarto e Banheiro</option>
                  <option value="Organização">Organização</option>
                  <option value="Itens Coringa">Itens Coringa</option>
                </select>
              </div>

              {/* UPLOAD DE IMAGEM */}
              <div className="space-y-2">
                <label className="font-medium text-[#73795B] uppercase tracking-wider block">
                  Foto do Presente (Upload direto)
                </label>
                
                <div className="flex items-center gap-3">
                  {formImageUrl ? (
                    <div className="relative w-20 h-20 rounded-[8px] overflow-hidden border border-[#E2D8C9] bg-[#EDE6DA] flex-shrink-0">
                      <img
                        src={formImageUrl}
                        alt="Prévia"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormImageUrl("")}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-[10px]"
                        title="Remover foto"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-[8px] border-2 border-dashed border-[#C7BCAB] bg-[#FBF8F3] flex flex-col items-center justify-center text-[#8C8073] text-[10px] flex-shrink-0">
                      <span>Sem foto</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center justify-center px-4 py-2.5 bg-[#FFFDFA] hover:bg-[#EDE6DA] border border-[#C7BCAB] rounded-[8px] font-medium text-[#493E33] cursor-pointer transition-colors w-full text-center">
                      <span>{isUploadingImage ? "Processando foto..." : "📁 Escolher foto do celular / PC"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-[#8C8073]">
                      Formatos aceitos: JPG, PNG, WEBP (até 4MB)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#73795B] uppercase tracking-wider block">Descrição</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalhes ou sugestões..."
                  className="w-full p-3 bg-[#FBF8F3] border border-[#C7BCAB] rounded-[8px] text-[16px] text-[#493E33]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#73795B] uppercase tracking-wider block">Link de Referência (Opcional)</label>
                <input
                  type="url"
                  value={formExternalUrl}
                  onChange={(e) => setFormExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-3 bg-[#FBF8F3] border border-[#C7BCAB] rounded-[8px] text-[16px] text-[#493E33]"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-[#F5E4DE] text-[#8C4832] border border-[#A9573F]/30 rounded-[8px] text-xs">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGiftModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-1/2 min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingImage}
                  className="w-1/2 min-h-[48px] rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] font-semibold disabled:opacity-50 shadow-soft"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Presente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO DEFINITIVA DE PRESENTE */}
      {deletingGift && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-8 max-w-md w-full shadow-floating space-y-4 safe-area-bottom">
            <h2 className="font-serif font-medium text-[#493E33] text-xl">
              Excluir “{deletingGift.name}” definitivamente?
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              Este presente será removido permanentemente do catálogo e não aparecerá mais em nenhuma lista.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeletingGift(null)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteGift(deletingGift.id)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#A9573F] hover:bg-[#8C4832] text-white text-xs font-semibold disabled:opacity-50"
              >
                {isSubmitting ? "Excluindo..." : "Excluir Definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE LIBERAÇÃO DE RESERVA */}
      {releasingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-8 max-w-md w-full shadow-floating space-y-4 safe-area-bottom">
            <h2 className="font-serif font-medium text-[#493E33] text-xl">
              Liberar presente para a lista pública?
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              O presente sairá da lista de reservas ativas e voltará a ficar disponível para qualquer convidado escolher.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setReleasingId(null)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReleaseReservation(releasingId)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-white text-xs font-semibold disabled:opacity-50"
              >
                {isSubmitting ? "Liberando..." : "Confirmar e Liberar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
