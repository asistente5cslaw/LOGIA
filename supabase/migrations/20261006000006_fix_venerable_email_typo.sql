-- Corrige el dominio real de la cuenta administrativa y conserva compatibilidad
-- con la variante escrita anteriormente.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    invite public.invitations%ROWTYPE;
    inv_code TEXT;
    assigned_role_id TEXT := 'her';
    assigned_degree TEXT := 'aprendiz';
    assigned_technical_role TEXT := 'member';
    member_uuid UUID;
    display_name TEXT;
    first_name TEXT;
    last_name TEXT;
BEGIN
    inv_code := NULLIF(trim(NEW.raw_user_meta_data ->> 'invitation_code'), '');

    IF inv_code IS NOT NULL THEN
        SELECT * INTO invite
        FROM public.invitations
        WHERE code = upper(inv_code)
          AND is_used = FALSE
          AND expires_at > now()
          AND (email IS NULL OR lower(email) = lower(NEW.email))
        FOR UPDATE;

        IF FOUND THEN
            assigned_role_id := invite.role_id;
            assigned_degree := invite.degree;
            UPDATE public.invitations
            SET is_used = TRUE, used_at = now(), used_by = NEW.id
            WHERE id = invite.id;
        END IF;
    END IF;

    IF assigned_role_id = 'her' AND NULLIF(trim(NEW.raw_user_meta_data ->> 'role_id'), '') IS NOT NULL THEN
        assigned_role_id := NEW.raw_user_meta_data ->> 'role_id';
    END IF;

    IF lower(trim(NEW.email)) IN ('asistente4@castillosucre.com', 'asistente4@astillosucre.com') THEN
        assigned_role_id := 'vm';
        assigned_degree := 'maestro';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = assigned_role_id) THEN
        assigned_role_id := 'her';
    END IF;

    SELECT technical_role INTO assigned_technical_role
    FROM public.roles WHERE id = assigned_role_id;
    IF assigned_technical_role IS NULL THEN assigned_technical_role := 'member'; END IF;

    display_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''), NEW.email);
    first_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''), split_part(display_name, ' ', 1), 'Hermano');
    last_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''), NULLIF(trim(regexp_replace(display_name, '^\S+\s*', '')), ''), 'Sin apellido');

    INSERT INTO public.profiles (id, email, display_name, role_id, technical_role, identity_verified, identity_status)
    VALUES (NEW.id, NEW.email, display_name, assigned_role_id, assigned_technical_role, FALSE, 'pending')
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        role_id = EXCLUDED.role_id,
        technical_role = EXCLUDED.technical_role,
        updated_at = now();

    INSERT INTO public.members (id, first_name, last_name, email, degree, role_id, created_by, updated_by)
    VALUES (NEW.id, first_name, last_name, NEW.email, assigned_degree, assigned_role_id, NEW.id, NEW.id)
    ON CONFLICT (email) DO NOTHING;

    SELECT id INTO member_uuid FROM public.members WHERE lower(email) = lower(NEW.email) LIMIT 1;
    UPDATE public.profiles SET member_id = member_uuid, updated_at = now() WHERE id = NEW.id;

    RETURN NEW;
END;
$$;
