import { supabase } from './supabase';

/**
 * Fetch paste metadata for Open Graph tags
 * Only fetches public metadata (name, created_at) without content
 */
export async function getPasteMetadata(id: string): Promise<{ name: string | null; created_at: string | null } | null> {
  try {
    const { data, error } = await supabase
      .from('pastes')
      .select('name, created_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      name: data.name || null,
      created_at: data.created_at || null,
    };
  } catch (error) {
    console.error('Error fetching paste metadata:', error);
    return null;
  }
}

