DROP POLICY IF EXISTS "Members delete own attendance" ON public.attendance;
CREATE POLICY "Members delete own attendance"
ON public.attendance
FOR DELETE TO authenticated
USING (public.is_member_owner(member_id));
