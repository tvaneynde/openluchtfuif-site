-- Scanner PIN verification reads config table as anon user
GRANT SELECT ON public.config TO anon;

-- Also allow anon to read ticket_tiers (needed for scanner cache load)
GRANT SELECT ON public.tickets TO anon;
