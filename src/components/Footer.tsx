import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#E2D8C9] bg-[#FBF8F3]/60 text-[#6B5D4E] py-12 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div className="space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="font-serif font-medium text-[#493E33] text-base">
              Chá de Panela
            </span>
            <span className="text-[#8C8073]">·</span>
            <span className="font-script text-[#73795B] text-lg">
              Débora &amp; Matheus
            </span>
          </div>
          <p className="text-xs text-[#8C8073]">
            Um encontro simples para celebrar o começo de uma casa com quem a gente ama.
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs text-[#8C8073]">
          <Link href="/" className="hover:text-[#493E33] transition-colors">
            Início
          </Link>
          <Link href="/presentes" className="hover:text-[#493E33] transition-colors">
            Lista de Presentes
          </Link>
          <Link href="/meus-presentes" className="hover:text-[#493E33] transition-colors">
            Meus Presentes
          </Link>
        </div>
      </div>

      {/* Traço com ornamento central */}
      <div className="max-w-6xl mx-auto pt-8 mt-8 border-t border-[#E2D8C9] flex items-center justify-between text-xs text-[#8C8073]">
        <span>21 de novembro de 2026 · 15:00</span>
        <span className="font-script text-[#73795B] text-base">um novo lar</span>
      </div>
    </footer>
  );
}
