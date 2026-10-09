-- Las respuestas personales no deben alterar el libro oficial de asistencia.
CREATE TABLE IF NOT EXISTS public.attendance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.event_degree_segments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('confirmada', 'excusa')),
  excuse_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (event_id, segment_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_responses_event_segment
  ON public.attendance_responses(event_id, segment_id);

ALTER TABLE public.attendance_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verified users view attendance responses" ON public.attendance_responses;
CREATE POLICY "Verified users view attendance responses"
  ON public.attendance_responses FOR SELECT TO authenticated
  USING (
    public.has_verified_identity()
    AND (
      public.is_venerable_or_admin_secretary()
      OR public.is_member_owner(member_id)
    )
  );

DROP POLICY IF EXISTS "Members submit own attendance responses" ON public.attendance_responses;
CREATE POLICY "Members submit own attendance responses"
  ON public.attendance_responses FOR INSERT TO authenticated
  WITH CHECK (
    public.has_verified_identity()
    AND public.is_member_owner(member_id)
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.status <> 'cancelada'
        AND (
          e.start_date > (timezone('America/Panama', now()))::date
          OR (
            e.start_date = (timezone('America/Panama', now()))::date
            AND COALESCE(e.start_time, time '23:59:59') > (timezone('America/Panama', now()))::time
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members update own attendance responses" ON public.attendance_responses;
CREATE POLICY "Members update own attendance responses"
  ON public.attendance_responses FOR UPDATE TO authenticated
  USING (
    public.has_verified_identity()
    AND public.is_member_owner(member_id)
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.status <> 'cancelada'
        AND (
          e.start_date > (timezone('America/Panama', now()))::date
          OR (
            e.start_date = (timezone('America/Panama', now()))::date
            AND COALESCE(e.start_time, time '23:59:59') > (timezone('America/Panama', now()))::time
          )
        )
    )
  )
  WITH CHECK (
    public.has_verified_identity()
    AND public.is_member_owner(member_id)
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.status <> 'cancelada'
        AND (
          e.start_date > (timezone('America/Panama', now()))::date
          OR (
            e.start_date = (timezone('America/Panama', now()))::date
            AND COALESCE(e.start_time, time '23:59:59') > (timezone('America/Panama', now()))::time
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members delete own attendance responses" ON public.attendance_responses;
CREATE POLICY "Members delete own attendance responses"
  ON public.attendance_responses FOR DELETE TO authenticated
  USING (
    public.has_verified_identity()
    AND public.is_member_owner(member_id)
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.start_date >= (timezone('America/Panama', now()))::date
        AND (
          e.start_date > (timezone('America/Panama', now()))::date
          OR COALESCE(e.start_time, time '23:59:59') > (timezone('America/Panama', now()))::time
        )
    )
  );

-- Solo VM y Secretario pueden modificar la asistencia oficial.
DROP POLICY IF EXISTS "Verified members add own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Verified members update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Verified members delete own attendance" ON public.attendance;
DROP POLICY IF EXISTS "VM and Secretary manage official attendance" ON public.attendance;

CREATE POLICY "VM and Secretary manage official attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (
    public.has_verified_identity()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id IN ('vm', 'sec')
    )
  )
  WITH CHECK (
    public.has_verified_identity()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id IN ('vm', 'sec')
    )
  );
