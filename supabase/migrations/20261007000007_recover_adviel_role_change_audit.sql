-- Recupera el cambio de Aprendiz a Venerable que inicialmente quedó registrado
-- únicamente como una edición general de la ficha.
INSERT INTO public.audit_logs (action, entity, entity_id, user_id, user_email, details, created_at)
SELECT
  'CAMBIAR_ROL_MIEMBRO',
  'members',
  m.id::text,
  p.id,
  p.email,
  jsonb_build_object(
    'targetMemberId', m.id,
    'targetName', concat_ws(' ', m.first_name, m.last_name),
    'actorName', p.display_name,
    'previousRoleId', 'apr',
    'newRoleId', 'vm',
    'source', 'recuperacion_auditoria'
  ),
  '2026-10-07 17:41:18.707+00'::timestamptz
FROM public.members m
JOIN public.profiles p ON lower(trim(p.email)) = 'acastillo@castillosucre.com'
WHERE lower(trim(m.email)) = 'advielcentenom@gmail.com'
  AND m.role_id = 'vm'
  AND NOT EXISTS (
    SELECT 1
    FROM public.audit_logs a
    WHERE a.action = 'CAMBIAR_ROL_MIEMBRO'
      AND a.entity = 'members'
      AND a.entity_id = m.id::text
      AND a.details ->> 'newRoleId' = 'vm'
  );
