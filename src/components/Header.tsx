"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const ADMIN_EMAILS = [
  "deboragabrielepereira@gmail.com",
  "matheusbazi01@gmail.com",
];

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

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleGoogleLogin() {
    const origin = window.location.origin;
    const nextUrl = pathname && pathname !== "/auth/callback" ? pathname : "/";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  const isAdmin = Boolean(
    user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim())
  );

  const navLinks = [
    { href: "/", label: "Início" },
    { href: "/presentes", label: "Lista de Presentes" },
    ...(user ? [{ href: "/meus-presentes", label: "Meus Presentes" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Painel dos Noivos" }] : []),
  ];

  return (
    <header className="border-b border-[#E2D8C9] bg-[#FBF8F3]/95 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-h-[44px]">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#EAEEE0] text-[#73795B] flex items-center justify-center border border-[#969E78]/30 group-hover:bg-[#D6DEC4] transition-colors flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21c0-5 3-9 8-10-1 6-4 9-8 10Z"></path>
              <path d="M12 21c0-5-3-9-8-10 1 6 4 9 8 10Z"></path>
              <path d="M12 21V9"></path>
              <path d="M12 9c0-3 2-5 5-6-1 4-2 6-5 6Z"></path>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-medium text-[#493E33] text-base sm:text-lg tracking-tight block leading-tight">
              Chá de Panela
            </span>
            <span className="font-script text-[#73795B] text-xs sm:text-sm leading-none block">
              Débora &amp; Matheus
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const isSpecialAdmin = link.href === "/admin";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-medium transition-colors pb-1 min-h-[44px] flex items-center ${
                  isSpecialAdmin
                    ? "text-[#73795B] font-semibold bg-[#EAEEE0] px-3 py-1 rounded-[8px] border border-[#969E78]/30 hover:bg-[#D6DEC4]"
                    : isActive
                    ? "text-[#565B43] border-b-2 border-[#73795B] font-semibold"
                    : "text-[#6B5D4E] hover:text-[#493E33]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border border-[#C7BCAB]"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[#EAEEE0] text-[#73795B] text-xs font-bold flex items-center justify-center">
                    {user.email?.[0].toUpperCase() ?? "U"}
                  </span>
                )}
                <span className="text-xs font-medium text-[#493E33] max-w-[130px] truncate">
                  {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-[8px] bg-[#EDE6DA] hover:bg-[#E2D8C9] text-[#6B5D4E] text-xs transition-colors font-medium min-h-[40px]"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleGoogleLogin}
                className="px-4 py-2 rounded-[10px] bg-[#FFFDFA] hover:bg-[#EDE6DA] border border-[#C7BCAB] text-[#493E33] text-xs font-medium transition-all shadow-soft min-h-[40px] flex items-center gap-2"
              >
                <GoogleIcon className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
              <Link
                href="/presentes"
                className="px-4 py-2 rounded-[10px] bg-[#6B7154] hover:bg-[#565B43] text-[#FBF8F3] text-xs font-medium tracking-wide transition-all shadow-soft min-h-[40px] flex items-center"
              >
                Ver Presentes
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Actions */}
        <div className="flex items-center gap-2 md:hidden">
          {!user && (
            <button
              onClick={handleGoogleLogin}
              className="px-2.5 py-1.5 bg-[#FFFDFA] border border-[#C7BCAB] text-[#493E33] rounded-[8px] text-xs font-medium min-h-[38px] flex items-center gap-1.5"
            >
              <GoogleIcon className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-11 h-11 flex items-center justify-center rounded-[8px] text-[#493E33] hover:bg-[#EDE6DA] active:bg-[#E2D8C9] transition-colors"
            aria-label={menuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#E2D8C9] bg-[#FBF8F3] px-4 py-5 space-y-3 shadow-card animate-in fade-in slide-in-from-top-2 duration-150">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center h-12 px-3 rounded-[8px] text-base font-medium text-[#493E33] hover:bg-[#EDEFE4] active:bg-[#EDE6DA]"
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <div className="pt-3 border-t border-[#E2D8C9] flex items-center justify-between">
              <div className="flex items-center gap-2 truncate max-w-[200px]">
                <span className="w-6 h-6 rounded-full bg-[#EAEEE0] text-[#73795B] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {user.email?.[0].toUpperCase() ?? "U"}
                </span>
                <span className="text-xs text-[#6B5D4E] truncate">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 bg-[#EDE6DA] rounded-[8px] text-xs text-[#493E33] font-medium min-h-[44px]"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-[#E2D8C9] space-y-2">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleGoogleLogin();
                }}
                className="w-full h-12 bg-[#FFFDFA] border border-[#C7BCAB] text-[#493E33] rounded-[12px] text-sm font-medium flex items-center justify-center gap-2.5 shadow-soft"
              >
                <GoogleIcon className="w-4 h-4" />
                Entrar com Google
              </button>
              <Link
                href="/presentes"
                onClick={() => setMenuOpen(false)}
                className="w-full h-12 bg-[#6B7154] text-[#FBF8F3] rounded-[12px] text-sm font-medium flex items-center justify-center shadow-soft"
              >
                Ver Lista de Presentes
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
