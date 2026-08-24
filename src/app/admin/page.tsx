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
    slug: string;
    name: string;
    category: string;
    image_url: string;
  };
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"reservations" | "gifts">("gifts");
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [gifts, setGifts] = useState<PublicGift[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais de Presentes
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<PublicGift | null>(null);
  const [deactivatingGift, setDeactivatingGift] = useState<PublicGift | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Cozinha");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formExternalUrl, setFormExternalUrl] = useState("");
  const [formExternalNote, setFormExternalNote] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);

  // Liberação de Reservas
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    try {
      const resRes = await fetch("/api/admin/reservations");
      const resJson = await resRes.json();
      if (resJson.success && Array.isArray(resJson.data)) {
        setReservations(resJson.data);
      }

      const giftRes = await fetch("/api/admin/gifts");
      const giftJson = await giftRes.json();
      if (giftJson.success && Array.isArray(giftJson.data)) {
        setGifts(giftJson.data);
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
    setEditingGift(null);
    setFormName("");
    setFormCategory("Cozinha");
    setFormDescription("");
    setFormImageUrl("");
    setFormExternalUrl("");
    setFormExternalNote("");
    setFormDisplayOrder(gifts.length + 1);
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
        loadData();
      } else {
        setErrorMessage(data.error || "Erro ao salvar presente.");
      }
    } catch {
      setErrorMessage("Erro de conexão ao salvar presente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivateGift(giftId: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: giftId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeactivatingGift(null);
        loadData();
      } else {
        alert(data.error || "Erro ao desativar presente.");
      }
    } catch {
      alert("Erro de conexão ao desativar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReactivateGift(giftId: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: giftId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao reativar presente.");
      }
    } catch {
      alert("Erro de conexão ao reativar.");
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
        setReservations((prev) =>
          prev.map((r) => (r.id === reservationId ? { ...r, status: "released_by_admin" } : r))
        );
        setReleasingId(null);
      } else {
        alert(data.message || "Erro ao liberar reserva.");
      }
    } catch {
      alert("Erro de conexão ao liberar reserva.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeReservations = reservations.filter((r) => r.status === "active");

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
              Gestão de Presentes &amp; Reservas
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
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Total de Itens</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#493E33]">{gifts.length}</p>
          </div>
          <div className="bg-[#FBF8F3] p-4 sm:p-5 rounded-[12px] border border-[#E2D8C9] space-y-1 shadow-soft">
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Itens Ativos</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#73795B]">{gifts.filter((g) => g.is_active !== false).length}</p>
          </div>
          <div className="bg-[#FBF8F3] p-4 sm:p-5 rounded-[12px] border border-[#E2D8C9] space-y-1 shadow-soft">
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Reservas Ativas</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#6B7154]">{activeReservations.length}</p>
          </div>
          <div className="bg-[#FBF8F3] p-4 sm:p-5 rounded-[12px] border border-[#E2D8C9] space-y-1 shadow-soft">
            <span className="text-[11px] sm:text-xs text-[#8C8073]">Itens Inativos</span>
            <p className="font-serif font-medium text-xl sm:text-2xl text-[#8C8073]">{gifts.filter((g) => g.is_active === false).length}</p>
          </div>
        </div>

        {/* Abas de Navegação Admin */}
        <div className="flex items-center gap-2 border-b border-[#E2D8C9] pb-2">
          <button
            onClick={() => setActiveTab("gifts")}
            className={`min-h-[44px] px-4 py-2 rounded-[8px] text-xs font-semibold transition-all flex items-center ${
              activeTab === "gifts"
                ? "bg-[#6B7154] text-[#FBF8F3] shadow-soft"
                : "bg-transparent text-[#6B5D4E] hover:bg-[#EDE6DA]"
            }`}
          >
            Catálogo ({gifts.length})
          </button>
          <button
            onClick={() => setActiveTab("reservations")}
            className={`min-h-[44px] px-4 py-2 rounded-[8px] text-xs font-semibold transition-all flex items-center ${
              activeTab === "reservations"
                ? "bg-[#6B7154] text-[#FBF8F3] shadow-soft"
                : "bg-transparent text-[#6B5D4E] hover:bg-[#EDE6DA]"
            }`}
          >
            Auditoria ({reservations.length})
          </button>
        </div>

        {/* TAB 1: GERENCIAMENTO DE PRESENTES (CRUD) */}
        {activeTab === "gifts" && (
          <div className="bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] overflow-hidden shadow-soft">
            <div className="p-4 sm:p-5 border-b border-[#E2D8C9]">
              <h2 className="font-serif font-medium text-[#493E33] text-base">
                Gerenciador de Presentes
              </h2>
              <p className="text-xs text-[#8C8073]">
                Adicione, edite ou desative presentes. A desativação preserva o histórico de reservas.
              </p>
            </div>

            {/* Mobile View: Cards */}
            <div className="sm:hidden divide-y divide-[#E2D8C9]/60">
              {gifts.map((gift) => {
                const isActive = gift.is_active !== false;
                return (
                  <div key={gift.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-[#8C8073] uppercase tracking-wider block">
                          #{gift.display_order} · {gift.category}
                        </span>
                        <h3 className="font-serif font-medium text-base text-[#493E33] truncate">
                          {gift.name}
                        </h3>
                      </div>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAEEE0] text-[#4E5B36] flex-shrink-0">
                          Ativo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE6DA] text-[#8C8073] flex-shrink-0">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openEditModal(gift)}
                        className="flex-1 min-h-[40px] bg-[#FFFDFA] border border-[#C7BCAB] rounded-[8px] text-xs font-medium text-[#493E33]"
                      >
                        Editar
                      </button>
                      {isActive ? (
                        <button
                          onClick={() => setDeactivatingGift(gift)}
                          className="flex-1 min-h-[40px] bg-[#F5E4DE] text-[#8C4832] border border-[#A9573F]/30 rounded-[8px] text-xs font-medium"
                        >
                          Remover
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateGift(gift.id)}
                          className="flex-1 min-h-[40px] bg-[#EAEEE0] text-[#4E5B36] border border-[#969E78]/30 rounded-[8px] text-xs font-medium"
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDE6DA] border-b border-[#E2D8C9] text-[#6B5D4E] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ordem</th>
                    <th className="py-3 px-4">Presente</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D8C9]/60">
                  {gifts.map((gift) => {
                    const isActive = gift.is_active !== false;

                    return (
                      <tr key={gift.id} className="hover:bg-[#EDE6DA]/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-[#8C8073]">{gift.display_order}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#493E33]">{gift.name}</div>
                          <div className="text-[11px] text-[#8C8073] line-clamp-1">{gift.description}</div>
                        </td>
                        <td className="py-3 px-4 text-[#6B5D4E]">{gift.category}</td>
                        <td className="py-3 px-4">
                          {isActive ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAEEE0] text-[#4E5B36]">
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE6DA] text-[#8C8073]">
                              Inativo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => openEditModal(gift)}
                            className="px-2.5 py-1 bg-[#FFFDFA] hover:bg-[#EDE6DA] border border-[#C7BCAB] rounded-[6px] text-xs font-medium text-[#493E33]"
                          >
                            Editar
                          </button>
                          {isActive ? (
                            <button
                              onClick={() => setDeactivatingGift(gift)}
                              className="px-2.5 py-1 bg-[#F5E4DE] hover:bg-[#A9573F] hover:text-white border border-[#A9573F]/30 rounded-[6px] text-xs font-medium text-[#8C4832] transition-colors"
                            >
                              Remover
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateGift(gift.id)}
                              className="px-2.5 py-1 bg-[#EAEEE0] hover:bg-[#6B7154] hover:text-white border border-[#969E78]/30 rounded-[6px] text-xs font-medium text-[#4E5B36] transition-colors"
                            >
                              Reativar
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

        {/* TAB 2: AUDITORIA DE RESERVAS */}
        {activeTab === "reservations" && (
          <div className="bg-[#FBF8F3] rounded-[12px] border border-[#E2D8C9] overflow-hidden shadow-soft">
            <div className="p-4 sm:p-5 border-b border-[#E2D8C9]">
              <h2 className="font-serif font-medium text-[#493E33] text-base">
                Histórico Completo de Auditoria
              </h2>
              <p className="text-xs text-[#8C8073]">
                Todas as reservas registradas e histórico de liberação.
              </p>
            </div>

            {reservations.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#8C8073]">
                Nenhuma reserva registrada até o momento.
              </div>
            ) : (
              <div>
                {/* Mobile View: Cards */}
                <div className="sm:hidden divide-y divide-[#E2D8C9]/60">
                  {reservations.map((res) => {
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
                      <div key={res.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-serif font-medium text-base text-[#493E33]">
                              {gift?.name || "Presente"}
                            </h3>
                            <p className="text-xs text-[#6B5D4E]">
                              {profile?.name || profile?.email || res.user_id}
                            </p>
                          </div>
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAEEE0] text-[#4E5B36]">
                              Ativa
                            </span>
                          ) : isCancelled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE6DA] text-[#8C8073]">
                              Cancelada
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#E8DED0] text-[#6B5D4E]">
                              Liberada Admin
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#8C8073] pt-1">
                          <span>{dateStr}</span>
                          {isActive && (
                            <button
                              onClick={() => setReleasingId(res.id)}
                              className="px-3 py-1.5 bg-[#F5E4DE] text-[#8C4832] rounded-[6px] font-medium text-xs"
                            >
                              Liberar
                            </button>
                          )}
                        </div>
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
                        <th className="py-3 px-4">Convidado</th>
                        <th className="py-3 px-4">Data/Hora</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2D8C9]/60">
                      {reservations.map((res) => {
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
                          <tr key={res.id} className="hover:bg-[#EDE6DA]/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-medium text-[#493E33]">{gift?.name || "Presente"}</div>
                              <div className="text-[11px] text-[#8C8073]">{gift?.category}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-[#493E33] font-medium">{profile?.name || "Convidado"}</div>
                              <div className="text-[11px] text-[#8C8073]">{profile?.email || res.user_id}</div>
                            </td>
                            <td className="py-3 px-4 text-[#6B5D4E] font-mono">{dateStr}</td>
                            <td className="py-3 px-4">
                              {isActive ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAEEE0] text-[#4E5B36]">
                                  Ativa
                                </span>
                              ) : isCancelled ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE6DA] text-[#8C8073]">
                                  Cancelada
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E8DED0] text-[#6B5D4E]">
                                  Liberada Admin
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
      </main>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PRESENTE (Responsivo para telas mobile) */}
      {isGiftModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-5 sm:p-8 max-w-lg w-full shadow-floating space-y-4 max-h-[90vh] overflow-y-auto safe-area-bottom">
            <h2 className="font-serif font-medium text-[#493E33] text-xl sm:text-2xl">
              {editingGift ? "Editar Presente" : "Novo Presente para o Catálogo"}
            </h2>

            <form onSubmit={handleSaveGift} className="space-y-3.5 text-xs">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-[#73795B] uppercase tracking-wider block">Categoria *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-3 bg-[#FBF8F3] border border-[#C7BCAB] rounded-[8px] text-[16px] text-[#493E33]"
                  >
                    <option value="Cozinha">Cozinha</option>
                    <option value="Mesa e Servir">Mesa e Servir</option>
                    <option value="Café e Café da Manhã">Café e Café da Manhã</option>
                    <option value="Limpeza">Limpeza</option>
                    <option value="Quarto e Banheiro">Quarto e Banheiro</option>
                    <option value="Organização">Organização</option>
                    <option value="Itens Coringa">Itens Coringa</option>
                    <option value="Itens mais pedidos">Itens mais pedidos</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[#73795B] uppercase tracking-wider block">Ordem</label>
                  <input
                    type="number"
                    min={1}
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                    className="w-full p-3 bg-[#FBF8F3] border border-[#C7BCAB] rounded-[8px] text-[16px] text-[#493E33]"
                  />
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
                <label className="font-medium text-[#73795B] uppercase tracking-wider block">URL da Imagem (Opcional)</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
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
                  disabled={isSubmitting}
                  className="w-1/2 min-h-[48px] rounded-[12px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Presente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO */}
      {deactivatingGift && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-8 max-w-md w-full shadow-floating space-y-4 safe-area-bottom">
            <h2 className="font-serif font-medium text-[#493E33] text-xl">
              Remover “{deactivatingGift.name}” da lista?
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              Ele deixará de aparecer para os convidados. O histórico existente será preservado.
            </p>
            {deactivatingGift.is_reserved && (
              <div className="p-3.5 bg-[#F6EBDA] border border-[#C08A3E]/45 rounded-[8px] text-xs text-[#7A5620]">
                ⚠️ <strong>Atenção:</strong> Este presente possui uma reserva ativa. Removê-lo do catálogo não cancela a reserva existente.
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeactivatingGift(null)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#493E33] text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeactivateGift(deactivatingGift.id)}
                disabled={isSubmitting}
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#A9573F] hover:bg-[#8C4832] text-white text-xs font-semibold disabled:opacity-50"
              >
                {isSubmitting ? "Removendo..." : "Remover da lista"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LIBERAÇÃO DE RESERVA */}
      {releasingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFDFA] rounded-t-[20px] sm:rounded-[20px] border border-[#E2D8C9] p-6 sm:p-8 max-w-md w-full shadow-floating space-y-4 safe-area-bottom">
            <h2 className="font-serif font-medium text-[#493E33] text-xl">
              Liberar reserva administrativamente?
            </h2>
            <p className="text-xs text-[#6B5D4E] leading-relaxed">
              O presente voltará a ficar disponível para outros convidados. O histórico de auditoria será preservado.
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
                className="w-1/2 min-h-[48px] rounded-[12px] bg-[#A9573F] hover:bg-[#8C4832] text-white text-xs font-semibold disabled:opacity-50"
              >
                {isSubmitting ? "Liberando..." : "Confirmar liberação"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
