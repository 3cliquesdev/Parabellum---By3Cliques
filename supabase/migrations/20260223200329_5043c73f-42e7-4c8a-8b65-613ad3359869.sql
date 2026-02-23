DROP FUNCTION IF EXISTS public.get_tickets_export_report(
  timestamp with time zone,
  timestamp with time zone,
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer
);