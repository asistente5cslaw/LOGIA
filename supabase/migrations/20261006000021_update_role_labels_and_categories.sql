-- Ajusta los nombres y la clasificación institucional de cargos.

UPDATE public.roles
SET name = 'Venerable Maestro', updated_at = now()
WHERE id = 'vm';

UPDATE public.roles
SET category = 'general', updated_at = now()
WHERE id = 'pm';
