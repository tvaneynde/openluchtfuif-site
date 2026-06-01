-- Grant service_role full access to all tables
-- (service_role is used by Edge Functions and server-side code,
--  RLS policies still apply for anon/authenticated roles)
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
