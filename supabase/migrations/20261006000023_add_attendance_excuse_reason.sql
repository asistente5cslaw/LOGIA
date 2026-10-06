-- Permite que cada hermano explique su propia excusa de asistencia.

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS excuse_reason TEXT;
