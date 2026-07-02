-- Split the seeded lineup across both stages so local/dev previews show the
-- two-stage layout out of the box; real bookings get assigned via the dashboard.
UPDATE lineup_artists SET stage = 'dub'
WHERE name IN ('Pitte & Runkel', 'Kleinefrigo', 'D-Nill');
