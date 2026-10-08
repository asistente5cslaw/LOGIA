-- Security hardening: never trust client-supplied role metadata during signup.
-- A privileged role must come from a valid invitation or an explicit server-side
-- designation already enforced by its own trigger.
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
  assigned_technical_role TEXT := 'member';
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
      UPDATE public.invitations
      SET is_used = TRUE, used_at = now(), used_by = NEW.id, updated_at = now()
      WHERE id = invite.id;
    END IF;
  END IF;

  SELECT technical_role INTO assigned_technical_role
  FROM public.roles WHERE id = assigned_role_id;
  assigned_technical_role := COALESCE(assigned_technical_role, 'member');

  INSERT INTO public.profiles (id, email, display_name, role_id, technical_role, identity_verified, identity_status)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''), NEW.email),
    assigned_role_id, assigned_technical_role, FALSE, 'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
