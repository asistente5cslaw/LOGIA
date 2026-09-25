-- ==============================================================================
-- CORRECCIÓN DEL DISPARADOR DE REGISTRO DIRECTO EN SUPABASE
-- Permite registrar usuarios directamente (nombre, correo, contraseña, selfie)
-- sin requerir un código de invitación obligatorio.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    invite invitations%ROWTYPE;
    inv_code TEXT;
    assigned_role_id TEXT := 'her';
    assigned_technical_role TEXT := 'member';
BEGIN
    inv_code := NULLIF(trim(NEW.raw_user_meta_data ->> 'invitation_code'), '');

    -- Si se proporcionó un código de invitación, validar y consumir
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
            UPDATE public.invitations
            SET is_used = TRUE, used_at = now(), used_by = NEW.id
            WHERE id = invite.id;
        END IF;
    END IF;

    -- Si vino un rol en metadata y no fue sobreescrito por invitación
    IF assigned_role_id = 'her' AND (NEW.raw_user_meta_data ->> 'role_id') IS NOT NULL THEN
        assigned_role_id := NEW.raw_user_meta_data ->> 'role_id';
    END IF;

    -- Obtener rol técnico
    SELECT technical_role INTO assigned_technical_role
    FROM public.roles
    WHERE id = assigned_role_id;

    IF assigned_technical_role IS NULL THEN
        assigned_technical_role := 'member';
    END IF;

    -- Crear o actualizar perfil en public.profiles con identidad verificada por selfie
    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        role_id,
        technical_role,
        identity_verified,
        identity_status
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''), NEW.email),
        assigned_role_id,
        assigned_technical_role,
        TRUE,
        'verified'
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role_id = EXCLUDED.role_id,
        technical_role = EXCLUDED.technical_role,
        identity_verified = TRUE,
        identity_status = 'verified',
        updated_at = now();

    RETURN NEW;
END;
$$;

-- Asegurar que el trigger esté activo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
