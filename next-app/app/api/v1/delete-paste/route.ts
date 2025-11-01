import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sanitizeError } from '@/lib/utils';
import { validateCsrf } from '@/lib/csrf';

/**
 * @swagger
 * /api/v1/delete-paste:
 *   delete:
 *     summary: Delete a paste by ID
 *     description: Delete a paste. Only the paste owner can delete their own pastes. Requires authentication.
 *     tags:
 *       - Authenticated
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Paste ID (UUID v4 or 6-character hex)
 *         example: "abc123"
 *     responses:
 *       200:
 *         description: Paste successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Paste deleted successfully"
 *       400:
 *         description: Missing or invalid paste ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - can only delete your own pastes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Paste not found
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
export async function DELETE(request: NextRequest) {
  try {
    // CSRF Protection: Validate request origin and CSRF token
    const csrfValidation = validateCsrf(request, true);
    if (!csrfValidation.isValid) {
      return NextResponse.json(
        { error: sanitizeError(csrfValidation.error, 'Request rejected for security reasons') },
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

    // Get paste ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const pasteId = searchParams.get('id');

    if (!pasteId) {
      return NextResponse.json(
        { error: 'Missing paste ID' },
        { status: 400 }
      );
    }

    // Validate ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const legacyRegex = /^[a-fA-F0-9]{6}$/;
    
    if (!uuidRegex.test(pasteId) && !legacyRegex.test(pasteId)) {
      return NextResponse.json(
        { error: 'Invalid paste ID format' },
        { status: 400 }
      );
    }

    // First, verify the paste exists and belongs to the user
    // RLS will enforce this, but we check first for better error messages
    const { data: paste, error: fetchError } = await supabase
      .from('pastes')
      .select('id, user_id')
      .eq('id', pasteId)
      .single();

    if (fetchError || !paste) {
      return NextResponse.json(
        { error: 'Paste not found' },
        { status: 404 }
      );
    }

    // Verify ownership (RLS also enforces this, but double-check for security)
    if (paste.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own pastes' },
        { status: 403 }
      );
    }

    // Delete the paste (RLS policy ensures only owner can delete)
    const { error: deleteError } = await supabase
      .from('pastes')
      .delete()
      .eq('id', pasteId);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete paste' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Paste deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in delete-paste:', error);
    return NextResponse.json(
      { error: sanitizeError(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

