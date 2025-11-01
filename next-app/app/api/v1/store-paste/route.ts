import { encrypt } from '@/lib/encryption';
import { supabase } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateBanterComment, generatePasteId, generateResponse, sanitizeError } from '@/lib/utils';
import { validateCsrf } from '@/lib/csrf';
import { NextRequest } from 'next/server';

/**
 * @swagger
 * /api/v1/store-paste:
 *   post:
 *     summary: Store a new paste
 *     description: |
 *       Store a new paste in the database. Supports both JSON and multipart/form-data.
 *       Public endpoint, but authentication is required if:
 *       - Providing user_id (must match authenticated user)
 *       - Providing password for password-protected paste
 *       - Providing name/title for the paste
 *     tags:
 *       - Public
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StorePasteRequest'
 *           example:
 *             paste: "Hello, World!"
 *             recipient_gh_username: "octocat"
 *             name: "My First Paste"
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               paste:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *               recipient_gh_username:
 *                 type: string
 *               name:
 *                 type: string
 *               user_id:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Paste successfully stored
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorePasteResponse'
 *       400:
 *         description: Missing required fields or paste size exceeds 400KB limit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorePasteResponse'
 *       401:
 *         description: Authentication required (when providing user_id or password)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorePasteResponse'
 *       403:
 *         description: Forbidden - user_id does not match authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorePasteResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorePasteResponse'
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let pasteContent: string;
    let recipientGhUsername: string;
    let pasteName: string | null = null;
    let userId: string | null = null;
    let password: string | null = null;

    // Handle multipart/form-data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const pasteText = formData.get('paste') as string | null;
      
      // Get paste content from file or text field
      if (file) {
        pasteContent = await file.text();
      } else if (pasteText) {
        pasteContent = pasteText;
      } else {
        return generateResponse(
          400,
          {
            message: 'Missing required field: file or paste',
            joke: generateBanterComment(),
          }
        );
      }

      recipientGhUsername = (formData.get('recipient_gh_username') as string) || 'unknown';
      pasteName = (formData.get('name') as string) || null;
      userId = (formData.get('user_id') as string) || null;
      password = (formData.get('password') as string) || null;
    } else {
      // Handle JSON request
      body = await request.json();
      pasteContent = body.paste;
      recipientGhUsername = body.recipient_gh_username;
      pasteName = body.name || null;
      userId = body.user_id || null;
      password = body.password || null;
    }

    // Validate required fields
    if (!pasteContent || !recipientGhUsername) {
      return generateResponse(
        400,
        {
          message: 'Missing required fields: paste (or file), recipient_gh_username',
          joke: generateBanterComment(),
        }
      );
    }

    // Check paste size (400KB limit)
    const pasteSize = new Blob([pasteContent]).size;
    if (pasteSize > 400 * 1024) {
      return generateResponse(
        400,
        {
          message: 'Paste size exceeds 400KB limit',
          joke: generateBanterComment(),
        }
      );
    }

    // Security: Validate user authentication if userId or password is provided
    let authenticatedUserId: string | null = null;
    if (userId || password) {
      // CSRF Protection: Validate request when authentication is used
      const csrfValidation = validateCsrf(request, true);
      if (!csrfValidation.isValid) {
        return generateResponse(
          403,
          {
            message: sanitizeError(csrfValidation.error, 'Request rejected for security reasons'),
            joke: generateBanterComment(),
          }
        );
      }

      const authSupabase = createServerSupabaseClient(request);
      const { data: { user }, error: authError } = await authSupabase.auth.getUser();
      
      if (authError || !user) {
        return generateResponse(
          401,
          {
            message: 'Authentication required when providing user_id or password',
            joke: generateBanterComment(),
          }
        );
      }
      
      authenticatedUserId = user.id;
      
      // Security: Ensure userId in request matches authenticated user
      // Prevent user_id spoofing attacks
      if (userId && userId !== authenticatedUserId) {
        return generateResponse(
          403,
          {
            message: 'Forbidden: user_id does not match authenticated user',
            joke: generateBanterComment(),
          }
        );
      }
      
      // If userId wasn't provided but password was, use authenticated user's ID
      if (!userId && password) {
        userId = authenticatedUserId;
      }
      
      // Security: Only allow password storage for authenticated users
      if (password && !authenticatedUserId) {
        return generateResponse(
          401,
          {
            message: 'Authentication required to store passwords',
            joke: generateBanterComment(),
          }
        );
      }
    }

    // Generate ID and timestamp
    const id = generatePasteId();
    const timestamp = new Date().toISOString();

    // Detect if content is password-encrypted
    // Password-encrypted content is hex-encoded (either new format "01" + salt + IV + data, or legacy IV + data)
    // Both formats are entirely hex-encoded, so we check if the entire string is hex
    const isPasswordEncrypted = /^[0-9a-fA-F]{32,}$/.test(pasteContent) && pasteContent.length > 32;

    // Encrypt the paste content (server-side encryption for storage)
    const encryptedPaste = encrypt(pasteContent);

    // Insert into Supabase
    const insertData: any = {
      id,
      paste: encryptedPaste,
      recipient_gh_username: recipientGhUsername,
      timestamp,
      is_password_encrypted: isPasswordEncrypted,
    };

    // Add optional fields if provided
    if (userId) {
      insertData.user_id = userId;
    }
    // Encrypt the name field if provided (following @db.mdc rule: all content must be encrypted)
    if (pasteName) {
      insertData.name = encrypt(pasteName.trim());
    }
    
    // Store password (encrypted) if provided and user is authenticated
    // Only store password for authenticated users who create password-protected pastes
    if (password && userId && isPasswordEncrypted && authenticatedUserId) {
      insertData.password = encrypt(password);
    }

    // Use authenticated client if user is authenticated, otherwise use service role
    // RLS policies will enforce security at database level
    const dbClient = authenticatedUserId ? createServerSupabaseClient(request) : supabase;
    const { error } = await dbClient.from('pastes').insert(insertData);

    if (error) {
      console.error('Database error:', error);
      return generateResponse(
        500,
        {
          message: 'Failed to insert paste into database',
          joke: generateBanterComment(),
        }
      );
    }

    // Return success response
    // Security: Do not return paste content or raw_data in response
    // Client already has the content locally - no need to echo it back
    return generateResponse(
      200,
      {
        message: 'The paste was successfully inserted into the database',
        id,
        timestamp,
        joke: generateBanterComment(),
      }
    );
  } catch (error: any) {
    console.error('Error in store-paste:', error);
    return generateResponse(
      500,
      {
        message: sanitizeError(error, 'Internal server error'),
        joke: generateBanterComment(),
      }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
