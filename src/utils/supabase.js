import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Get a public URL for a file in the images bucket.
// Usage: imgUrl('gallery/photo-1.jpg')
//        imgUrl('artists/thurbo.jpg')
//        imgUrl('partners/spar.png')
export function imgUrl(path) {
  return `${supabaseUrl}/storage/v1/object/public/images/${path}`;
}
