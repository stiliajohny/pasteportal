import { supabase } from './supabase';

/**
 * Fetch paste metadata for Open Graph tags
 * Only fetches public metadata (name, created_at) without content
 * Returns null on timeout or error to prevent blocking page load
 */
export async function getPasteMetadata(id: string): Promise<{ name: string | null; created_at: string | null } | null> {
  try {
    // Create timeout promise that rejects after 2 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Metadata fetch timeout')), 2000);
    });

    // Race between database query and timeout
    const queryPromise = supabase
      .from('pastes')
      .select('name, created_at')
      .eq('id', id)
      .single();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error || !data) {
      return null;
    }

    return {
      name: data.name || null,
      created_at: data.created_at || null,
    };
  } catch (error) {
    // Silently fail - metadata is optional for SEO, page will still load
    return null;
  }
}

