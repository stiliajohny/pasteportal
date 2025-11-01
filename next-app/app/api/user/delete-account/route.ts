import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';
import { sanitizeError } from '@/lib/utils';
import { validateCsrf } from '@/lib/csrf';

/**
 * @swagger
 * /api/user/delete-account:
 *   post:
 *     summary: Delete user account
 *     description: |
 *       Delete (disable) the authenticated user's account. 
 *       Note: Full deletion requires admin privileges, so the account is disabled instead.
 *       Removes profile picture from storage and signs out the user.
 *       Requires authentication.
 *     tags:
 *       - Authenticated
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Account successfully disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteAccountResponse'
 *             example:
 *               message: "Account disabled successfully"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Bad request - failed to disable account
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
export async function POST(request: NextRequest) {
  try {
    // CSRF Protection: Validate request origin and CSRF token
    const csrfValidation = validateCsrf(request, true);
    if (!csrfValidation.isValid) {
      return NextResponse.json(
        { error: sanitizeError(csrfValidation.error, 'Request rejected for security reasons') },
        { status: 403 }
      );
    }

    const supabase = createClient();
    
    // Get current user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete profile picture from storage if exists (check common extensions)
    const avatarUrl = user.user_metadata?.avatar_url;
    if (avatarUrl) {
      const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      const deletePromises = extensions.map(ext => 
        supabase.storage
          .from('profile-pictures')
          .remove([`${user.id}/avatar.${ext}`])
      );
      await Promise.all(deletePromises);
    }

    // Update user metadata to mark account as disabled
    // Note: Supabase doesn't allow deleting users via client SDK
    // In a production app, you would use Admin API to fully delete
    // For now, we mark the account as disabled in metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        account_disabled: true,
        disabled_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      console.error('Account update error:', updateError);
      return NextResponse.json(
        { error: sanitizeError(updateError, 'Failed to disable account') },
        { status: 400 }
      );
    }

    // Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json(
      { message: 'Account disabled successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to delete account') },
      { status: 500 }
    );
  }
}

