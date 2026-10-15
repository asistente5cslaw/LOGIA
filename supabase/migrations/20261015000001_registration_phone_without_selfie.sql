-- Registro sin selfie y teléfono obligatorio.
-- Conserva las columnas selfie existentes para no alterar datos históricos.

ALTER TABLE public.lodge_settings
  ADD COLUMN IF NOT EXISTS current_secretary_phone TEXT;

UPDATE public.lodge_settings
SET current_secretary = COALESCE(NULLIF(current_secretary, ''), 'Alexis Castillo Gaona'),
    current_secretary_phone = COALESCE(NULLIF(current_secretary_phone, ''), '+50767471286')
WHERE id = (SELECT id FROM public.lodge_settings ORDER BY id LIMIT 1);

CREATE OR REPLACE FUNCTION public.get_registration_contact()
RETURNS TABLE(secretary_name TEXT, secretary_phone TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(current_secretary, ''), 'Alexis Castillo Gaona'),
    COALESCE(NULLIF(current_secretary_phone, ''), '+50767471286')
  FROM public.lodge_settings
  ORDER BY id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_registration_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_registration_contact() TO anon, authenticated;

DROP POLICY IF EXISTS "Members can update own phone" ON public.members;
CREATE POLICY "Members can update own phone"
ON public.members
FOR UPDATE TO authenticated
USING (id = auth.uid() AND deleted_at IS NULL)
WITH CHECK (id = auth.uid() AND deleted_at IS NULL);

GRANT UPDATE (phone, updated_at) ON public.members TO authenticated;

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
    registration_phone TEXT;
BEGIN
    inv_code := NULLIF(trim(NEW.raw_user_meta_data ->> 'invitation_code'), '');
    registration_phone := NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '');

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

    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = assigned_role_id) THEN
        assigned_role_id := 'her';
    END IF;

    SELECT technical_role INTO assigned_technical_role
    FROM public.roles WHERE id = assigned_role_id;
    assigned_technical_role := COALESCE(assigned_technical_role, 'member');

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

    INSERT INTO public.members (id, first_name, last_name, email, phone, degree, role_id, created_by, updated_by)
    VALUES (NEW.id, first_name, last_name, NEW.email, registration_phone, assigned_degree, assigned_role_id, NEW.id, NEW.id)
    ON CONFLICT (email) DO UPDATE SET
        phone = COALESCE(public.members.phone, EXCLUDED.phone),
        updated_at = now();

    SELECT id INTO member_uuid
    FROM public.members
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    UPDATE public.profiles
    SET member_id = member_uuid, updated_at = now()
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
