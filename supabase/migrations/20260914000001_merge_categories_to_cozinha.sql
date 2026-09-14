-- =====================================================================
-- MIGRAÇÃO: Unificar 'Mesa e Servir' e 'Café e Café da Manhã' em 'Cozinha'
-- =====================================================================

-- 1. Atualizar todos os presentes no banco de dados
UPDATE public.gifts
SET category = 'Cozinha',
    updated_at = NOW()
WHERE category IN ('Mesa e Servir', 'Café e Café da Manhã');

-- 2. Atualizar quaisquer variações ou sem acentos
UPDATE public.gifts
SET category = 'Cozinha',
    updated_at = NOW()
WHERE category ILIKE '%mesa e servir%'
   OR category ILIKE '%café%'
   OR category ILIKE '%cafe%';
