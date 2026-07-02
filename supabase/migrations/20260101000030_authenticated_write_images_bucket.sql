-- The dashboard's CMS panels (artist photos, partner logos) previously asked
-- admins to type a raw storage path by hand. Replacing that with a real file
-- upload control means the browser now needs to write to the `images` bucket
-- directly via the Supabase client — authenticated admins get full access,
-- matching the same "authenticated = trusted admin" pattern already used for
-- every other admin-managed table (partners, lineup_artists, etc).

CREATE POLICY "Authenticated write access to images bucket"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'images')
  WITH CHECK (bucket_id = 'images');
