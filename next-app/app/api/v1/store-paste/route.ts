import { encrypt } from '@/lib/encryption';
import { detectSecrets, redactSecrets } from '@/lib/secret-detection';
import { supabase } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  generateBanterComment,
  generatePasteId,
  generateResponse,
  sanitizeError,
  sanitizeGitHubUsername,
  sanitizePasteName,
  sanitizeTags,
  secureLogError,
  validateInputLength,
  validateRequestSize,
} from '@/lib/utils';
import { validateCsrf } from '@/lib/csrf';
import { corsOptionsResponse } from '@/lib/cors';
import { applyRateLimit, rateLimitConfigs } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

/**
 * @swagger
 * /api/v1/store-paste:
 *   post:
 *     summary: Store a new paste
 *     description: |
 *       Store a new paste in the database. Supports both JSON and multipart/form-data.
 *       Public endpoint. Authentication is required only if:
 *       - Providing password for password-protected paste
 *       If user_id is provided but authentication fails, the paste will be created anonymously.
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
    // Apply rate limiting (public endpoint, use default config)
    const rateLimitResponse = applyRateLimit(request, rateLimitConfigs.default);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let pasteContent: string;
    let recipientGhUsername: string;
    let pasteName: string | null = null;
    let userId: string | null = null;
    let password: string | null = null;
    let tags: string | null = null;

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
          },
          undefined,
          request
        );
      }

      const rawRecipientGhUsername = (formData.get('recipient_gh_username') as string) || 'unknown';
      const rawPasteName = (formData.get('name') as string) || null;
      const rawUserId = (formData.get('user_id') as string) || null;
      const rawPassword = (formData.get('password') as string) || null;
      const rawTags = (formData.get('tags') as string) || null;
      
      // Sanitize and validate inputs
      recipientGhUsername = sanitizeGitHubUsername(rawRecipientGhUsername) || 'unknown';
      pasteName = rawPasteName ? sanitizePasteName(rawPasteName) : null;
      userId = rawUserId ? validateInputLength(rawUserId, 100).sanitized : null;
      password = rawPassword ? validateInputLength(rawPassword, 30, 8).sanitized : null;
      tags = rawTags ? sanitizeTags(rawTags) : null;
    } else {
      // Handle JSON request
      // Validate request size before parsing
      const sizeValidation = validateRequestSize(request.headers.get('content-length'));
      if (!sizeValidation.isValid) {
        return generateResponse(
          413,
          {
            message: sizeValidation.error || 'Request entity too large',
            joke: generateBanterComment(),
          },
          undefined,
          request
        );
      }
      
      body = await request.json();
      pasteContent = body.paste;
      const rawRecipientGhUsername = body.recipient_gh_username;
      const rawPasteName = body.name;
      const rawUserId = body.user_id;
      const rawPassword = body.password;
      const rawTags = body.tags;
      
      // Sanitize and validate inputs
      recipientGhUsername = rawRecipientGhUsername
        ? sanitizeGitHubUsername(rawRecipientGhUsername) || 'unknown'
        : 'unknown';
      pasteName = rawPasteName ? sanitizePasteName(rawPasteName) : null;
      userId = rawUserId ? validateInputLength(rawUserId, 100).sanitized : null;
      password = rawPassword ? validateInputLength(rawPassword, 30, 8).sanitized : null;
      tags = rawTags ? sanitizeTags(rawTags) : null;
    }

    // Validate required fields
    if (!pasteContent || !recipientGhUsername || recipientGhUsername === '') {
      return generateResponse(
        400,
        {
          message: 'Missing required fields: paste (or file), recipient_gh_username',
          joke: generateBanterComment(),
        },
        undefined,
        request
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
        },
        undefined,
        request
      );
    }

    // Security: Validate user authentication
    // Only require authentication if password is provided (for password-protected pastes)
    // For userId, try to authenticate but allow anonymous pastes if auth fails
    let authenticatedUserId: string | null = null;
    
    // If password is provided, authentication is required
    if (password) {
      // CSRF Protection: Validate request when authentication is used
      const csrfValidation = validateCsrf(request, true);
      if (!csrfValidation.isValid) {
        return generateResponse(
          403,
          {
            message: sanitizeError(csrfValidation.error, 'Request rejected for security reasons'),
            joke: generateBanterComment(),
          },
          undefined,
          request
        );
      }

      const authSupabase = createServerSupabaseClient(request);
      const { data: { user }, error: authError } = await authSupabase.auth.getUser();
      
      if (authError || !user) {
        // Log auth error for debugging (in development only)
        if (process.env.NODE_ENV === 'development') {
          console.error('[store-paste] Auth error:', authError);
          console.error('[store-paste] Cookie header:', request.headers.get('cookie')?.substring(0, 200));
        }
        
        return generateResponse(
          401,
          {
            message: 'Authentication required when providing password for password-protected pastes. Please sign in again.',
            joke: generateBanterComment(),
          },
          undefined,
          request
        );
      }
      
      authenticatedUserId = user.id;
      
      // If userId wasn't provided but password was, use authenticated user's ID
      if (!userId) {
        userId = authenticatedUserId;
      }
      
      // Security: Ensure userId in request matches authenticated user
      // Prevent user_id spoofing attacks
      if (userId && userId !== authenticatedUserId) {
        return generateResponse(
          403,
          {
            message: 'Forbidden: user_id does not match authenticated user',
            joke: generateBanterComment(),
          },
          undefined,
          request
        );
      }
    } else if (userId) {
      // If userId is provided but no password, try to authenticate
      // If auth fails, just ignore userId and create anonymous paste
      // This allows logged-in users to create pastes, but doesn't block if auth fails
      try {
        const csrfValidation = validateCsrf(request, true);
        if (csrfValidation.isValid) {
          const authSupabase = createServerSupabaseClient(request);
          const { data: { user }, error: authError } = await authSupabase.auth.getUser();
          
          if (!authError && user) {
            authenticatedUserId = user.id;
            
            // Security: Ensure userId in request matches authenticated user
            // Prevent user_id spoofing attacks
            if (userId !== authenticatedUserId) {
              // If userId doesn't match, ignore it and create anonymous paste
              userId = null;
            }
          } else {
            // Auth failed, ignore userId and create anonymous paste
            userId = null;
          }
        } else {
          // CSRF validation failed, ignore userId and create anonymous paste
          userId = null;
        }
      } catch (error) {
        // If any error occurs during auth check, ignore userId and create anonymous paste
        userId = null;
      }
    }

    // Generate ID and timestamp
    const id = generatePasteId();
    const timestamp = new Date().toISOString();

    // Server-side secret detection (backup check in case client-side check is bypassed)
    // Only check if content is not already password-encrypted (encrypted content won't match patterns)
    const isPasswordEncrypted = /^[0-9a-fA-F]{32,}$/.test(pasteContent) && pasteContent.length > 32;
    let finalPasteContent = pasteContent;
    
    if (!isPasswordEncrypted) {
      const secrets = detectSecrets(pasteContent);
      if (secrets.length > 0) {
        // Automatically redact secrets on server side as a security measure
        // Log warning for security monitoring
        secureLogError('Secrets detected in paste content - auto-redacting', {
          pasteId: id,
          secretCount: secrets.length,
          secretTypes: secrets.map(s => s.type),
        });
        const redacted = redactSecrets(pasteContent);
        finalPasteContent = redacted.redactedText;
      }
    }

    // Encrypt the paste content (server-side encryption for storage)
    const encryptedPaste = encrypt(finalPasteContent);

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
    
    // Encrypt tags if provided (following @db.mdc rule: all content must be encrypted)
    if (tags) {
      insertData.tags = encrypt(tags.trim());
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
      secureLogError('Database error in store-paste', error);
      return generateResponse(
        500,
        {
          message: 'Failed to insert paste into database',
          joke: generateBanterComment(),
        },
        undefined,
        request
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
      },
      undefined,
      request
    );
  } catch (error: any) {
    secureLogError('Error in store-paste', error);
    return generateResponse(
      500,
      {
        message: sanitizeError(error, 'Internal server error'),
        joke: generateBanterComment(),
      },
      undefined,
      request
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request, 'POST, OPTIONS');
}
