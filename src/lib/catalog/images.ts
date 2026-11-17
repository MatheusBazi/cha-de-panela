import { createHash } from "crypto";

/**
 * Fotos antigas ficam gravadas no banco como "data:image/...;base64,...".
 * Mandar isso dentro da lista deixa a resposta com vários MB. Aqui trocamos
 * por um endereço curto (/api/gifts/<id>/image) que o navegador baixa só
 * quando a foto aparece na tela e guarda em cache.
 * O parâmetro "v" muda quando a foto muda, então o cache nunca fica velho.
 */
export function publicImageUrl(
  giftId: string | null | undefined,
  imageUrl: string | null | undefined
): string | null {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith("data:")) return imageUrl;
  if (!giftId) return null;
  const v = createHash("md5").update(imageUrl).digest("hex").slice(0, 10);
  return `/api/gifts/${giftId}/image?v=${v}`;
}
