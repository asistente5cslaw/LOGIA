-- Sincroniza los códigos usados por la interfaz con la FK members.role_id.
-- Estos roles son cargos/grados operativos válidos en el directorio.

INSERT INTO public.roles (id, name, category, "order", technical_role) VALUES
('vig', 'Vigilantes', 'dignatario', 4, 'dignitary'),
('pm', 'Past Master', 'dignatario', 5, 'dignitary'),
('mae', 'Maestro', 'general', 6, 'member'),
('comp', 'Compañero', 'general', 7, 'member'),
('apr', 'Aprendiz', 'general', 8, 'member')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  "order" = EXCLUDED."order",
  technical_role = EXCLUDED.technical_role,
  updated_at = now();
