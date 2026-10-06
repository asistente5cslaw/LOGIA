-- Restaura únicamente catálogos y configuración base necesarios para operar
-- el sistema después de limpiar los datos de negocio.

INSERT INTO public.bodies (id, name, short_name, symbol, color, description) VALUES
('uf21', 'Resp.·. Log.·. Unión Fraternal No. 21', 'Logia UF21', '📐', '#78292A', 'Taller madre en Panamá'),
('glp', 'Muy Resp.·. Gran Logia de Panamá', 'Gran Logia de Panamá', '🏛️', '#2B5B84', 'Gran Oriente de Panamá'),
('interlogias', 'Relaciones Interlogiales', 'Interlogias', '🤝', '#C05621', 'Encuentros y visitas entre talleres'),
('york', 'Cuerpos del Rito York', 'Rito York', '☩', '#701A75', 'Capítulo de Real Arco, Concilio y Encomienda Templaria'),
('supremo_consejo', 'Supremo Consejo del Grado 33', 'Supremo Consejo', '🦅', '#1E1E24', 'R.E.A.A. para Panamá'),
('shriners', 'Abou Saad Shriners', 'Shriners', '🌙', '#B83A28', 'Fraternidad filantrópica Shriner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.official_visit_checklist (id, title, description, completed) VALUES
(1, 'Lista de asistencia', 'Registro formal y actualizado de asistencia a todas las tenidas celebradas', false),
(2, 'Libro de Actas', 'Libro de actas foliado, firmado y al día con actas debidamente aprobadas', false),
(3, 'Libro de Tesorería', 'Control de cuentas, cuotas mensuales e ingresos/egresos del taller', false),
(4, 'Carta Constitutiva', 'Carta Patente original expedida por la Gran Logia en exhibición y resguardo', false),
(5, 'Código Masónico Reformado', 'Ejemplar físico o digital vigente del Código de la Gran Logia', false),
(6, 'Estatutos del Taller', 'Reglamento interno aprobado y concordante con los estatutos generales', false),
(7, 'Libros de Registro', 'Libro de oro de firmas, registros de afiliaciones e iniciaciones', false),
(8, 'Cuestionario de Visitas Oficiales', 'Formulario oficial diligenciado para la comisión inspectora de Gran Logia', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lodge_settings (
  lodge_name, lodge_number, orient, rite, charter_date,
  regular_meeting_days, temple_address, contact_email
)
SELECT
  'Resp.·. Log.·. Unión Fraternal No. 21',
  21,
  'Oriente de Panamá',
  'Rito Escocés Antiguo y Aceptado',
  '1921-06-24',
  'Todos los 2do y 4to miércoles de cada mes a las 7:30 p.m.',
  '',
  'secretaria@unionfraternal21.org'
WHERE NOT EXISTS (SELECT 1 FROM public.lodge_settings);
