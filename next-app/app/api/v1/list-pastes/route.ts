import { validateOrigin } from '@/lib/csrf';
import { decrypt } from '@/lib/encryption';
import { applyRateLimit, rateLimitConfigs } from '@/lib/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sanitizeError, secureLogError } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic since it uses request.headers
export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/v1/list-pastes:
 *   get:
 *     summary: List all pastes for authenticated user
 *     description: Retrieve all pastes belonging to the authenticated user. Returns metadata only (not paste content). Requires authentication.
 *     tags:
 *       - Authenticated
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of pastes successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListPastesResponse'
 *             example:
 *               pastes:
 *                 - id: "abc123"
 *                   name: "My Paste"
 *                   timestamp: "2024-01-01T00:00:00.000Z"
 *                   created_at: "2024-01-01T00:00:00.000Z"
 *                   is_password_encrypted: false
 *                   password: null
 *                   display_name: "My Paste"
 *               count: 1
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (authenticated endpoint)
    const rateLimitResponse = applyRateLimit(request, rateLimitConfigs.authenticated);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // CSRF Protection: Validate request origin
    // Note: For GET requests, origin validation is sufficient since they don't modify state
    // Authentication is still required separately, which prevents unauthorized access
    const originValid = validateOrigin(request);
    if (!originValid) {
      return NextResponse.json(
        { error: 'Invalid origin. Request rejected for security reasons.' },
        { status: 403 }
      );
    }

    const supabase = createServerSupabaseClient(request);

    // Get current user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Query pastes for this user
    const { data, error } = await supabase
      .from('pastes')
      .select('id, name, timestamp, created_at, is_password_encrypted, password')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      secureLogError('Database error in list-pastes', error);
      return NextResponse.json(
        { error: 'Failed to retrieve pastes' },
        { status: 500 }
      );
    }

    // Return pastes with formatted data
    // Decrypt name and password fields if present (following @db.mdc rule: all content must be encrypted)
    const pastes = (data || []).map((paste) => {
      let decryptedName: string | null = null;
      if (paste.name) {
        try {
          decryptedName = decrypt(paste.name);
        } catch (error) {
          secureLogError('Failed to decrypt paste name in list-pastes', error);
          // If decryption fails, use null (fallback to timestamp)
          decryptedName = null;
        }
      }

      let decryptedPassword: string | null = null;
      // Only decrypt password for password-protected pastes that have a stored password
      if (paste.password && paste.is_password_encrypted) {
        try {
          decryptedPassword = decrypt(paste.password);
        } catch (error) {
          secureLogError('Failed to decrypt paste password in list-pastes', error);
          // If decryption fails, password remains null
          decryptedPassword = null;
        }
      }

      return {
        id: paste.id,
        name: decryptedName,
        timestamp: paste.timestamp,
        created_at: paste.created_at,
        is_password_encrypted: paste.is_password_encrypted || false,
        password: decryptedPassword, // Decrypted password (only for user's own pastes)
        // Generate display name: use custom name or formatted timestamp
        display_name: decryptedName || new Date(paste.created_at).toLocaleString(),
      };
    });

    return NextResponse.json(
      {
        pastes,
        count: pastes.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    secureLogError('Error in list-pastes', error);
    return NextResponse.json(
      { error: sanitizeError(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

