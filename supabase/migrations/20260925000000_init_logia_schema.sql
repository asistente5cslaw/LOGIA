-- ==============================================================================
-- LOGIA MASÓNICA PWA - DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- Schema version: 1.0.0
-- Compatible with PostgreSQL 15+ and Supabase Auth
-- ==============================================================================

BEGIN;

-- Enable UUID and cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- This migration is additive and never drops existing lodge data.

-- ------------------------------------------------------------------------------
-- 1. PROFILES (Extends auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    member_id UUID,
    role_id TEXT NOT NULL DEFAULT 'her',
    technical_role TEXT NOT NULL DEFAULT 'member' CHECK (technical_role IN ('admin', 'secretary', 'dignitary', 'treasurer', 'member')),
    identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    identity_status TEXT NOT NULL DEFAULT 'pending' CHECK (identity_status IN ('pending', 'verified', 'rejected', 'not_started')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role_id ON profiles(role_id);

-- ------------------------------------------------------------------------------
-- 2. ROLES & PERMISSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE roles (
    id TEXT PRIMARY KEY, -- 'vm', 'pv', 'sv', 'sec', 'tes', etc.
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('dignatario', 'oficial', 'general')),
    "order" INTEGER NOT NULL,
    technical_role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE permissions (
    id TEXT PRIMARY KEY, -- 'view', 'create', 'edit', 'approve', 'archive', etc.
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE role_permissions (
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (role_id, permission_id)
);

-- ------------------------------------------------------------------------------
-- 3. MEMBERS (Ficha masónica de miembros)
-- ------------------------------------------------------------------------------
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    degree TEXT NOT NULL DEFAULT 'aprendiz' CHECK (degree IN ('aprendiz', 'companero', 'maestro')),
    condition TEXT NOT NULL DEFAULT 'activo' CHECK (condition IN ('activo', 'ad_vitam', 'dual', 'inactivo')),
    role_id TEXT NOT NULL REFERENCES roles(id) DEFAULT 'her',
    mother_lodge TEXT DEFAULT 'Resp.·. Log.·. Unión Fraternal No. 21',
    initiation_date DATE,
    passing_date DATE,
    raising_date DATE,
    diploma_number TEXT,
    passport_number TEXT,
    other_bodies TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ, -- Soft delete
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_members_degree ON members(degree);
CREATE INDEX idx_members_condition ON members(condition);
CREATE INDEX idx_members_is_active ON members(is_active);
CREATE INDEX idx_members_email ON members(email);

ALTER TABLE profiles
    ADD CONSTRAINT fk_profiles_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

CREATE TABLE member_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. INVITATIONS (Registro por invitación previa)
-- ------------------------------------------------------------------------------
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    email TEXT,
    degree TEXT NOT NULL DEFAULT 'aprendiz' CHECK (degree IN ('aprendiz', 'companero', 'maestro')),
    role_id TEXT NOT NULL REFERENCES roles(id) DEFAULT 'her',
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_invitations_code ON invitations(code);

-- ------------------------------------------------------------------------------
-- 5. IDENTITY VERIFICATIONS (Biometría y Consentimiento - Ley 81 de 2019 de Panamá)
-- ------------------------------------------------------------------------------
CREATE TABLE identity_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'internal_liveness', -- e.g., 'onfido', 'persona', 'internal_liveness'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    liveness_score NUMERIC(5, 4),
    biometric_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    consent_ip_address TEXT,
    rejection_reason TEXT,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_identity_user_id ON identity_verifications(user_id);

-- ------------------------------------------------------------------------------
-- 6. BODIES (Cuerpos Masónicos)
-- ------------------------------------------------------------------------------
CREATE TABLE bodies (
    id TEXT PRIMARY KEY, -- 'uf21', 'glp', 'interlogias', 'york', 'supremo_consejo', 'shriners'
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 7. EVENTS & CONFLICTS
-- ------------------------------------------------------------------------------
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body_id TEXT NOT NULL REFERENCES bodies(id) ON DELETE RESTRICT,
    degree_required TEXT NOT NULL DEFAULT 'aprendiz' CHECK (degree_required IN ('aprendiz', 'companero', 'maestro')),
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME WITHOUT TIME ZONE,
    end_time TIME WITHOUT TIME ZONE,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_meeting BOOLEAN NOT NULL DEFAULT TRUE, -- Tenida protocolar vs evento general
    location TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'programada' CHECK (status IN ('programada', 'convocada', 'celebrada', 'cancelada')),
    conflict_justification TEXT,
    conflict_approved_by UUID REFERENCES auth.users(id),
    conflict_approved_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_body_id ON events(body_id);
CREATE INDEX idx_events_status ON events(status);

CREATE TABLE event_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id_1 UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_id_2 UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 8. MINUTES (Libro de Actas de Tenidas)
-- ------------------------------------------------------------------------------
CREATE TABLE minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number INTEGER NOT NULL, -- Consecutivo anual
    year INTEGER NOT NULL,
    format_number TEXT NOT NULL UNIQUE, -- '01-2026'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    degree TEXT NOT NULL DEFAULT 'aprendiz' CHECK (degree IN ('aprendiz', 'companero', 'maestro')),
    status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'circulada', 'aprobada', 'firmada', 'archivada')),
    volume TEXT, -- Tomo
    folio TEXT, -- Folio
    notes TEXT,
    pdf_url TEXT,
    pdf_file_name TEXT,
    pdf_file_size INTEGER,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_minutes_number_year UNIQUE (number, year)
);

CREATE INDEX idx_minutes_year ON minutes(year);
CREATE INDEX idx_minutes_meeting_date ON minutes(meeting_date);
CREATE INDEX idx_minutes_status ON minutes(status);
CREATE INDEX idx_minutes_degree ON minutes(degree);

CREATE TABLE minute_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    minute_id UUID NOT NULL REFERENCES minutes(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    read_at TIMESTAMPTZ,
    UNIQUE (minute_id, member_id)
);

CREATE TABLE minute_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    minute_id UUID NOT NULL REFERENCES minutes(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id),
    author_name TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 9. ATTENDANCE (Asistencia a Tenidas)
-- ------------------------------------------------------------------------------
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'presente' CHECK (status IN ('presente', 'excusa', 'ausente')),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (event_id, member_id)
);

CREATE INDEX idx_attendance_event ON attendance(event_id);
CREATE INDEX idx_attendance_member ON attendance(member_id);

CREATE TABLE attendance_visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    lodge TEXT NOT NULL,
    degree TEXT NOT NULL DEFAULT 'maestro' CHECK (degree IN ('aprendiz', 'companero', 'maestro')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_attendance_visitors_event ON attendance_visitors(event_id);

-- ------------------------------------------------------------------------------
-- 10. LODGE SETTINGS & OFFICIAL VISIT
-- ------------------------------------------------------------------------------
CREATE TABLE lodge_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lodge_name TEXT NOT NULL DEFAULT 'Resp.·. Log.·. Unión Fraternal No. 21',
    lodge_number INTEGER NOT NULL DEFAULT 21,
    orient TEXT NOT NULL DEFAULT 'Oriente de Panamá',
    rite TEXT NOT NULL DEFAULT 'Rito Escocés Antiguo y Aceptado',
    charter_date DATE NOT NULL DEFAULT '1921-06-24',
    regular_meeting_days TEXT NOT NULL DEFAULT 'Todos los 2do y 4to miércoles de cada mes',
    temple_address TEXT NOT NULL DEFAULT 'Gran Templo Masónico, Calle 43 Bella Vista, Ciudad de Panamá',
    contact_email TEXT NOT NULL DEFAULT 'secretaria@unionfraternal21.org',
    current_venerable_master TEXT,
    current_secretary TEXT,
    privacy_policy_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE official_visit_checklist (
    id INTEGER PRIMARY KEY, -- 1 through 8
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 11. AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    user_id UUID,
    user_email TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity);

-- ------------------------------------------------------------------------------
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_invitations_updated_at BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_identity_verifications_updated_at BEFORE UPDATE ON identity_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_minutes_updated_at BEFORE UPDATE ON minutes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_lodge_settings_updated_at BEFORE UPDATE ON lodge_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_official_visit_checklist_updated_at BEFORE UPDATE ON official_visit_checklist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- SEED INITIAL SYSTEM DATA (Roles, Permissions, Bodies, Checklist)
-- ------------------------------------------------------------------------------
INSERT INTO permissions (id, name, description) VALUES
('view', 'Ver registros', 'Acceso general de lectura'),
('create', 'Crear registros', 'Creación de eventos, actas y notas'),
('edit', 'Editar registros', 'Modificación de registros'),
('approve', 'Aprobar actas y acuerdos', 'Aprobación formal de actas del taller'),
('archive', 'Archivar documentos', 'Mover documentos a archivo histórico'),
('manage_users', 'Administrar usuarios', 'Crear y validar cuentas e invitaciones'),
('manage_members', 'Administrar miembros', 'Alta, baja y fichas de miembros'),
('manage_events', 'Gestionar eventos', 'Crear y convocar tenidas y eventos'),
('manage_minutes', 'Gestionar actas', 'Redacción y gestión del libro de actas'),
('manage_attendance', 'Gestionar asistencia', 'Toma y edición de asistencias'),
('view_sensitive_info', 'Ver información sensible', 'Visualización de diplomas, pasaportes y afiliaciones'),
('export_data', 'Exportar datos', 'Generación de respaldos JSON/CSV'),
('configure_lodge', 'Configurar logia', 'Ajustes del taller y checklist');

INSERT INTO roles (id, name, category, "order", technical_role) VALUES
('vm', 'Venerable Maestro', 'dignatario', 1, 'admin'),
('pv', 'Primer Vigilante', 'dignatario', 2, 'dignitary'),
('sv', 'Segundo Vigilante', 'dignatario', 3, 'dignitary'),
('sec', 'Secretario', 'dignatario', 4, 'admin'),
('tes', 'Tesorero', 'dignatario', 5, 'treasurer'),
('ora', 'Orador', 'dignatario', 6, 'dignitary'),
('mc', 'Maestro de Ceremonia', 'dignatario', 7, 'dignitary'),
('vmi', 'Venerable Maestro Inmediato', 'dignatario', 8, 'dignitary'),
('pe', 'Primer Experto', 'oficial', 9, 'member'),
('se', 'Segundo Experto', 'oficial', 10, 'member'),
('pd', 'Primer Diácono', 'oficial', 11, 'member'),
('sd', 'Segundo Diácono', 'oficial', 12, 'member'),
('gt', 'Guarda Templo', 'oficial', 13, 'member'),
('hos', 'Hospitalario', 'oficial', 14, 'member'),
('arm', 'Maestro de la Armonía', 'oficial', 15, 'member'),
('her', 'Hermano', 'general', 16, 'member');

INSERT INTO bodies (id, name, short_name, symbol, color, description) VALUES
('uf21', 'Resp.·. Log.·. Unión Fraternal No. 21', 'Logia UF21', '📐', '#78292A', 'Taller madre en Panamá'),
('glp', 'Muy Resp.·. Gran Logia de Panamá', 'Gran Logia de Panamá', '🏛️', '#2B5B84', 'Gran Oriente de Panamá'),
('interlogias', 'Relaciones Interlogiales', 'Interlogias', '🤝', '#C05621', 'Encuentros y visitas entre talleres'),
('york', 'Cuerpos del Rito York', 'Rito York', '☩', '#701A75', 'Capítulo de Real Arco, Concilio y Encomienda Templaria'),
('supremo_consejo', 'Supremo Consejo del Grado 33', 'Supremo Consejo', '🦅', '#1E1E24', 'R.E.A.A. para Panamá'),
('shriners', 'Abou Saad Shriners', 'Shriners', '🌙', '#B83A28', 'Fraternidad filantrópica Shriner');

INSERT INTO official_visit_checklist (id, title, description, completed) VALUES
(1, 'Lista de asistencia', 'Registro formal y actualizado de asistencia a todas las tenidas celebradas', false),
(2, 'Libro de Actas', 'Libro de actas foliado, firmado y al día con actas debidamente aprobadas', false),
(3, 'Libro de Tesorería', 'Control de cuentas, cuotas mensuales e ingresos/egresos del taller', false),
(4, 'Carta Constitutiva', 'Carta Patente original expedida por la Gran Logia en exhibición y resguardo', false),
(5, 'Código Masónico Reformado', 'Ejemplar físico o digital vigente del Código de la Gran Logia', false),
(6, 'Estatutos del Taller', 'Reglamento interno aprobado y concordante con los estatutos generales', false),
(7, 'Libros de Registro', 'Libro de oro de firmas, registros de afiliaciones e iniciaciones', false),
(8, 'Cuestionario de Visitas Oficiales', 'Formulario oficial diligenciado para la comisión inspectora de Gran Logia', false);

INSERT INTO lodge_settings (lodge_name, lodge_number, orient, rite, charter_date, regular_meeting_days, temple_address, contact_email)
VALUES (
    'Resp.·. Log.·. Unión Fraternal No. 21',
    21,
    'Oriente de Panamá',
    'Rito Escocés Antiguo y Aceptado',
    '1921-06-24',
    'Todos los 2do y 4to miércoles de cada mes a las 7:30 p.m.',
    'Gran Templo Masónico, Calle 43 Bella Vista, Ciudad de Panamá',
    'secretaria@unionfraternal21.org'
);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_invitation(p_code TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite invitations%ROWTYPE;
BEGIN
    SELECT * INTO invite
    FROM invitations
    WHERE code = upper(trim(p_code))
      AND is_used = FALSE
      AND expires_at > now()
      AND (email IS NULL OR lower(email) = lower(trim(p_email)))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', FALSE, 'message', 'Código no válido, vencido o asignado a otro correo.');
    END IF;

    RETURN jsonb_build_object('valid', TRUE, 'invitation', jsonb_build_object(
        'id', invite.id, 'code', invite.code, 'email', invite.email,
        'degree', invite.degree, 'role_id', invite.role_id, 'expires_at', invite.expires_at
    ));
END;
$$;

REVOKE ALL ON FUNCTION validate_invitation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_invitation(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION handle_new_auth_user()
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

    SELECT technical_role INTO assigned_technical_role
    FROM public.roles
    WHERE id = assigned_role_id;

    IF assigned_technical_role IS NULL THEN
        assigned_technical_role := 'member';
    END IF;

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
        FALSE,
        'pending'
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role_id = EXCLUDED.role_id,
        technical_role = EXCLUDED.technical_role,
        updated_at = now();

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE minute_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE minute_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lodge_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_visit_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin/secretary
CREATE OR REPLACE FUNCTION is_admin_or_secretary()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND technical_role IN ('admin', 'secretary')
    );
$$;

CREATE OR REPLACE FUNCTION is_member_owner(target_member_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.members
        WHERE id = target_member_id
          AND lower(email) = lower(auth.jwt() ->> 'email')
          AND deleted_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION can_read_minute(target_minute_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.minutes m
        WHERE m.id = target_minute_id AND m.deleted_at IS NULL
          AND (
              public.is_admin_or_secretary()
              OR EXISTS (
                  SELECT 1 FROM public.members member_record
                  WHERE lower(member_record.email) = lower(auth.jwt() ->> 'email')
                    AND m.status IN ('circulada', 'aprobada', 'firmada', 'archivada')
                    AND CASE member_record.degree
                        WHEN 'aprendiz' THEN m.degree = 'aprendiz'
                        WHEN 'companero' THEN m.degree IN ('aprendiz', 'companero')
                        WHEN 'maestro' THEN m.degree IN ('aprendiz', 'companero', 'maestro')
                        ELSE FALSE
                    END
              )
              OR EXISTS (
                  SELECT 1 FROM public.minute_access access_record
                  WHERE access_record.minute_id = m.id
                    AND public.is_member_owner(access_record.member_id)
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION is_admin_or_secretary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin_or_secretary() TO authenticated;
REVOKE ALL ON FUNCTION is_member_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_member_owner(UUID) TO authenticated;
REVOKE ALL ON FUNCTION can_read_minute(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_read_minute(UUID) TO authenticated;

CREATE POLICY "Authenticated users read roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users read permissions" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users read role permissions" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users read bodies" ON bodies FOR SELECT TO authenticated USING (true);

-- Profiles: Authenticated users can view profiles, users can update own profile, admins can manage all
CREATE POLICY "Authenticated users can view profiles" ON profiles
    FOR SELECT TO authenticated USING (auth.uid() = id OR is_admin_or_secretary());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url) ON profiles TO authenticated;

-- Members: Authenticated users can view active members; Admins/Secretaries can insert, update, soft-delete
CREATE POLICY "Admins can read members" ON members
    FOR SELECT TO authenticated USING (is_admin_or_secretary());

CREATE POLICY "Admins can manage members" ON members
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

CREATE POLICY "Admins manage invitations" ON invitations
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());
CREATE POLICY "Users read their identity verification" ON identity_verifications
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin_or_secretary());
CREATE POLICY "Admins manage identity verifications" ON identity_verifications
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

-- Events: All authenticated users can view non-deleted events; Admins/Secretaries can insert/update
CREATE POLICY "Events visible to authenticated users" ON events
    FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Admins can manage events" ON events
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

CREATE POLICY "Admins manage event conflicts" ON event_conflicts
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

-- Minutes: Users can only see approved/circulated minutes according to degree and individual access
CREATE POLICY "Authorized users can view minutes" ON minutes
    FOR SELECT TO authenticated USING (can_read_minute(id));

CREATE POLICY "Admins can manage minutes" ON minutes
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

CREATE POLICY "Members read their minute access" ON minute_access
    FOR SELECT TO authenticated USING (is_admin_or_secretary() OR is_member_owner(member_id));
CREATE POLICY "Admins grant minute access" ON minute_access
    FOR INSERT TO authenticated WITH CHECK (is_admin_or_secretary());
CREATE POLICY "Authorized users read corrections" ON minute_corrections
    FOR SELECT TO authenticated USING (can_read_minute(minute_id));
CREATE POLICY "Authorized users add corrections" ON minute_corrections
    FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND can_read_minute(minute_id));

-- Attendance: Visible to authenticated; managed by admins/ceremony master
CREATE POLICY "Attendance visible to authenticated" ON attendance
    FOR SELECT TO authenticated USING (is_admin_or_secretary() OR is_member_owner(member_id));

CREATE POLICY "Admins can manage attendance" ON attendance
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

CREATE POLICY "Members add own attendance" ON attendance
    FOR INSERT TO authenticated WITH CHECK (is_member_owner(member_id));
CREATE POLICY "Members update own attendance" ON attendance
    FOR UPDATE TO authenticated USING (is_member_owner(member_id)) WITH CHECK (is_member_owner(member_id));
CREATE POLICY "Admins manage attendance visitors" ON attendance_visitors
    FOR ALL TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

-- Settings & Checklist: Read by all authenticated, modified by admin/secretary
CREATE POLICY "Settings viewable by authenticated" ON lodge_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Checklist viewable by authenticated" ON official_visit_checklist
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Checklist editable by admins" ON official_visit_checklist
    FOR UPDATE TO authenticated USING (is_admin_or_secretary()) WITH CHECK (is_admin_or_secretary());

-- Audit logs: Read by admins, inserted by system
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT TO authenticated USING (is_admin_or_secretary());

CREATE POLICY "Authenticated can create audit log" ON audit_logs
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

COMMIT;
