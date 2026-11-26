-- El padrón de hermanos puede incluir personas sin cuenta de usuario.
ALTER TABLE public.members
  ALTER COLUMN email DROP NOT NULL;

-- Hermanos del padrón que aún no tienen cuenta en la aplicación.
INSERT INTO public.members (first_name, last_name, email, degree, role_id, condition, identity_status, identity_verified)
SELECT roster.first_name, roster.last_name, NULL, 'companero', 'comp', 'activo', 'not_started', FALSE
FROM (VALUES
  ('José', 'Abouganem Gadeloff'),
  ('Abdel', 'Almengor Echeverria'),
  ('Arón', 'Benzadon Amores'),
  ('Gonzalo', 'Cateriano Muñiz'),
  ('Juan Carlos', 'Cedeño Ulloa'),
  ('Rafael Alejandro', 'Cedeño Vargas'),
  ('Guillermo', 'Clark Cano'),
  ('Roberto', 'Cueto Cisneros'),
  ('Ricardo Joaquín', 'Davis Bosch'),
  ('Felipe', 'Escalada Acosta'),
  ('Jose Antonio', 'Ferreira Queimada'),
  ('Helmut Ahmed', 'Flores-Calamari'),
  ('Ricardo', 'Fuller Yero'),
  ('Ricardo Alberto', 'Halphen'),
  ('Javier', 'Jimenez Ezpondaburu'),
  ('Luis', 'Laguerre Romero'),
  ('Ricardo Adolfo', 'Landero Miranda'),
  ('Carlos Eduardo', 'Lopez-Echaniz Corro'),
  ('Joel Sadín', 'Martínez Santos'),
  ('Luis Temístocles', 'Moreno López'),
  ('Carlos Francisco', 'Mornhinweg Williams'),
  ('Sergio', 'Naranjo'),
  ('Rogelio Ignacio', 'Orillac Giraldo'),
  ('Ewaldo', 'Pitti Aparicio'),
  ('Ramón A.', 'Policart Zafrani'),
  ('Carlos Guillermo', 'Qvistgaard'),
  ('Moises Augusto', 'Sanchez Ulate'),
  ('Humberto', 'Vilchez'),
  ('Ioannis', 'Zajaratos Guzmán')
) AS roster(first_name, last_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.members existing
  WHERE lower(existing.first_name) = lower(roster.first_name)
    AND lower(existing.last_name) = lower(roster.last_name)
);
