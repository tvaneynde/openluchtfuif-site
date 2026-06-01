-- Explicit grants per table for authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_tiers  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_events   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_log     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users   TO authenticated;

GRANT SELECT ON public.ticket_tiers TO anon;
