-- The `images` storage bucket is public (serves partner logos, artist photos,
-- and archive photos via direct URLs), but storage.objects had zero RLS
-- policies. Direct object downloads still worked because the bucket's public
-- flag bypasses RLS for that code path, but Storage's list() API (used by the
-- /archief page to enumerate archive photos) enforces RLS and silently
-- returned an empty array for everyone — hence "0 FOTO'S".

CREATE POLICY "Public read access to images bucket"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'images');
