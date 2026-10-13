-- Recupera registros donde Auth/Profile existen pero falta la ficha members.
-- También guarda la selfie en la misma operación para no perderla.

CREATE OR REPLACE FUNCTION public.complete_registration_identity(
    p_selfie_url TEXT,
    p_identity_status TEXT DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    profile_row public.profiles%ROWTYPE;
    member_uuid UUID;
    safe_status TEXT := CASE WHEN p_identity_status = 'rejected' THEN 'rejected' ELSE 'pending' END;
    display_name TEXT;
    first_name TEXT;
    last_name TEXT;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Sesión no autenticada';
    END IF;

    SELECT * INTO profile_row
    FROM public.profiles
    WHERE id = current_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el perfil del usuario';
    END IF;

    member_uuid := profile_row.member_id;

    IF member_uuid IS NULL THEN
        display_name := COALESCE(NULLIF(trim(profile_row.display_name), ''), profile_row.email);
        first_name := COALESCE(NULLIF(trim(split_part(display_name, ' ', 1)), ''), 'Hermano');
        last_name := COALESCE(NULLIF(trim(regexp_replace(display_name, '^\S+\s*', '')), ''), 'Sin apellido');

        INSERT INTO public.members (id, first_name, last_name, email, degree, role_id, created_by, updated_by)
        VALUES (current_user_id, first_name, last_name, profile_row.email, 'aprendiz', COALESCE(profile_row.role_id, 'her'), current_user_id, current_user_id)
        ON CONFLICT (email) DO NOTHING;

        SELECT id INTO member_uuid
        FROM public.members
        WHERE lower(email) = lower(profile_row.email)
        LIMIT 1;

        IF member_uuid IS NULL THEN
            RAISE EXCEPTION 'No se pudo crear la ficha de miembro';
        END IF;

        UPDATE public.profiles
        SET member_id = member_uuid, updated_at = now()
        WHERE id = current_user_id;
    END IF;

    UPDATE public.members
    SET identity_verified = FALSE,
        identity_status = safe_status,
        selfie_url = p_selfie_url,
        identity_validated_at = now(),
        updated_at = now()
    WHERE id = member_uuid;

    RETURN member_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_registration_identity(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_registration_identity(TEXT, TEXT) TO authenticated;
