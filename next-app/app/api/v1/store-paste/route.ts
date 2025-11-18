import { corsOptionsResponse } from '@/lib/cors';
import { validateCsrf } from '@/lib/csrf';
import { encrypt } from '@/lib/encryption';
import { applyRateLimit, rateLimitConfigs } from '@/lib/rate-limit';
import { detectSecrets, getSecretTags, redactSecrets } from '@/lib/secret-detection';
import { supabase } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
    generateBanterComment,
    generatePasteId,
    generateResponse,
    hashPasteContent,
    sanitizeError,
    sanitizeGitHubUsername,
    sanitizePasteName,
    sanitizeTags,
    secureLogError,
    validateInputLength,
    validateRequestSize,
} from '@/lib/utils';
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
 *       409:
 *         description: Conflict - duplicate paste content detected
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

    // Hash paste content for duplicate detection
    // Hash is computed on original content before any modifications (secret redaction, encryption)
    const contentHash = hashPasteContent(pasteContent);

    // Detect platform and hostname from request headers
    // Platform can be explicitly set via X-Platform header, or detected from User-Agent
    // Note: HTTP headers are case-insensitive, Next.js Headers API normalizes to lowercase
    let platform: string | null = null;
    let hostname: string | null = null;
    let platformSource: string = 'unknown';
    
    // First, try direct get (Next.js normalizes headers to lowercase)
    // This is the most reliable method
    const platformHeader = request.headers.get('x-platform');
    const hostnameHeader = request.headers.get('x-hostname');
    
    // Log raw header values for debugging
    console.log('[store-paste] ===== HEADER DETECTION DEBUG =====');
    console.log('[store-paste] Raw header values:', {
      'x-platform': platformHeader,
      'x-hostname': hostnameHeader,
      'x-platform-type': typeof platformHeader,
      'x-hostname-type': typeof hostnameHeader,
    });
    
    if (platformHeader) {
      const sanitizedPlatform = platformHeader.trim().toLowerCase().substring(0, 50);
      console.log('[store-paste] Platform header processing:', {
        original: platformHeader,
        sanitized: sanitizedPlatform,
        regexTest: /^[a-z0-9_-]+$/.test(sanitizedPlatform),
      });
      if (/^[a-z0-9_-]+$/.test(sanitizedPlatform)) {
        platform = sanitizedPlatform;
        platformSource = 'X-Platform header (direct)';
        console.log('[store-paste] Platform set from X-Platform header:', platform);
      } else {
        console.warn('[store-paste] Platform header failed regex validation:', {
          original: platformHeader,
          sanitized: sanitizedPlatform,
        });
      }
    } else {
      console.log('[store-paste] No X-Platform header found');
    }
    
    if (hostnameHeader) {
      const sanitizedHostname = hostnameHeader.trim().toLowerCase().substring(0, 255);
      console.log('[store-paste] Hostname header processing:', {
        original: hostnameHeader,
        sanitized: sanitizedHostname,
        regexTest: /^[a-z0-9.-]+$/.test(sanitizedHostname),
      });
      if (/^[a-z0-9.-]+$/.test(sanitizedHostname)) {
        hostname = sanitizedHostname;
        console.log('[store-paste] Hostname set from X-Hostname header:', hostname);
      } else {
        console.warn('[store-paste] Hostname header failed regex validation:', {
          original: hostnameHeader,
          sanitized: sanitizedHostname,
        });
      }
    } else {
      console.log('[store-paste] No X-Hostname header found');
    }
    
    // Fallback: Iterate through all headers (in case direct get doesn't work)
    if (!platform || !hostname) {
      console.log('[store-paste] Falling back to header iteration...');
      request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        
        if (lowerKey === 'x-platform' && !platform) {
          const sanitizedPlatform = value.trim().toLowerCase().substring(0, 50);
          if (/^[a-z0-9_-]+$/.test(sanitizedPlatform)) {
            platform = sanitizedPlatform;
            platformSource = 'X-Platform header (iteration)';
            console.log('[store-paste] Platform set from iteration:', platform);
          }
        }
        
        if (lowerKey === 'x-hostname' && !hostname) {
          const sanitizedHostname = value.trim().toLowerCase().substring(0, 255);
          if (/^[a-z0-9.-]+$/.test(sanitizedHostname)) {
            hostname = sanitizedHostname;
            console.log('[store-paste] Hostname set from iteration:', hostname);
          }
        }
      });
    }
    
    // If platform still not found, detect from User-Agent
    if (!platform) {
      const userAgent = request.headers.get('user-agent') || '';
      console.log('[store-paste] No platform header found, checking User-Agent:', userAgent);
      if (userAgent.toLowerCase().includes('vscode') || userAgent.toLowerCase().includes('code')) {
        platform = 'vscode';
        platformSource = 'User-Agent (vscode detected)';
      } else if (userAgent) {
        // Default to 'web' for browser requests
        platform = 'web';
        platformSource = 'User-Agent (web default)';
      } else {
        // Fallback: default to 'web' if no User-Agent
        platform = 'web';
        platformSource = 'fallback (no User-Agent)';
      }
      console.log('[store-paste] Platform set from User-Agent/fallback:', platform);
    }

    // Debug logging (always log to help diagnose issues)
    console.log('[store-paste] ===== PASTE CREATION DEBUG =====');
    console.log('[store-paste] Final Platform:', platform);
    console.log('[store-paste] Final Hostname:', hostname);
    console.log('[store-paste] Platform source:', platformSource);
    console.log('[store-paste] User-Agent:', request.headers.get('user-agent'));
    
    // Log ALL headers to see what's actually being received
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value.length > 100 ? value.substring(0, 100) + '...' : value;
    });
    console.log('[store-paste] All headers received:', JSON.stringify(allHeaders, null, 2));
    console.log('[store-paste] ===================================');

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

    // Check for duplicate paste content
    // For authenticated users: check per-user duplicates
    // For anonymous users: check global duplicates (optional - can be skipped for privacy)
    // Use authenticated client if available, otherwise use service role
    const dbClientForCheck = authenticatedUserId ? createServerSupabaseClient(request) : supabase;
    
    let duplicatePaste: { id: string } | null = null;
    
    if (userId) {
      // Check for duplicate for authenticated user
      const { data: duplicateData, error: duplicateError } = await dbClientForCheck
        .from('pastes')
        .select('id')
        .eq('content_hash', contentHash)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      
      if (duplicateError) {
        secureLogError('Error checking for duplicate paste', duplicateError);
        // Don't fail the request if duplicate check fails - log and continue
      } else if (duplicateData) {
        duplicatePaste = duplicateData;
      }
    } else {
      // For anonymous users, optionally check for global duplicates
      // This can be enabled/disabled based on privacy requirements
      // For now, we'll check for anonymous duplicates to prevent spam
      const { data: duplicateData, error: duplicateError } = await dbClientForCheck
        .from('pastes')
        .select('id')
        .eq('content_hash', contentHash)
        .is('user_id', null)
        .limit(1)
        .maybeSingle();
      
      if (duplicateError) {
        secureLogError('Error checking for duplicate paste', duplicateError);
        // Don't fail the request if duplicate check fails - log and continue
      } else if (duplicateData) {
        duplicatePaste = duplicateData;
      }
    }
    
    // If duplicate found, return 409 Conflict with existing paste ID
    if (duplicatePaste) {
      return generateResponse(
        409,
        {
          message: `This paste content has already been submitted. You can view it using the paste ID: ${duplicatePaste.id}`,
          existing_id: duplicatePaste.id,
          joke: generateBanterComment(),
        },
        undefined,
        request
      );
    }

    // Generate ID and timestamp
    const id = generatePasteId();
    const timestamp = new Date().toISOString();

    // Server-side secret detection (backup check in case client-side check is bypassed)
    // Only check if content is not already password-encrypted (encrypted content won't match patterns)
    const isPasswordEncrypted = /^[0-9a-fA-F]{32,}$/.test(pasteContent) && pasteContent.length > 32;
    let finalPasteContent = pasteContent;
    let secretsWereRedacted = false;
    
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
        secretsWereRedacted = true;
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
      content_hash: contentHash,
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
    // Add security tags if secrets were redacted on server side
    let finalTags = tags;
    if (secretsWereRedacted) {
      // Get the detected secrets to determine which tags to add
      const secrets = detectSecrets(pasteContent);
      const secretTags = getSecretTags(secrets);
      
      // Add contains-secrets tag and specific secret type tags
      const securityTag = 'contains-secrets';
      const tagsToAdd = [securityTag, ...secretTags];
      
      if (finalTags) {
        // Add tags that don't already exist
        const existingTags = finalTags.split(',').map(t => t.trim());
        const newTags = tagsToAdd.filter(tag => !existingTags.includes(tag));
        if (newTags.length > 0) {
          finalTags = `${finalTags.trim()},${newTags.join(',')}`;
        }
      } else {
        finalTags = tagsToAdd.join(',');
      }
    }
    if (finalTags) {
      insertData.tags = encrypt(finalTags.trim());
    }
    
    // Store password (encrypted) if provided and user is authenticated
    // Only store password for authenticated users who create password-protected pastes
    if (password && userId && isPasswordEncrypted && authenticatedUserId) {
      insertData.password = encrypt(password);
    }

    // Add platform and hostname (platform should always be set, hostname is optional)
    // Ensure platform is always set (should never be null due to fallback logic above)
    insertData.platform = platform || 'unknown';
    if (hostname) {
      insertData.hostname = hostname;
    }

    // Debug logging (always log to help diagnose issues)
    console.log('[store-paste] ===== DATABASE INSERT DEBUG =====');
    console.log('[store-paste] Insert data includes:', {
      platform: insertData.platform,
      hostname: insertData.hostname,
      hasPlatform: !!insertData.platform,
      hasHostname: !!insertData.hostname,
      platformValue: insertData.platform,
      hostnameValue: insertData.hostname,
      insertDataKeys: Object.keys(insertData),
    });
    console.log('[store-paste] Platform variable before insert:', platform);
    console.log('[store-paste] Hostname variable before insert:', hostname);
    console.log('[store-paste] Platform source:', platformSource);

    // Use authenticated client if user is authenticated, otherwise use anon key client
    // RLS policies will enforce security at database level:
    // - Anonymous users (anon key): can insert with user_id = NULL (auth.uid() IS NULL)
    // - Authenticated users: can insert with user_id = auth.uid() (must match authenticated user)
    const dbClient = authenticatedUserId ? createServerSupabaseClient(request) : supabase;
    
    // Log what we're about to insert (excluding sensitive data)
    console.log('[store-paste] About to insert with platform:', insertData.platform, 'hostname:', insertData.hostname);
    console.log('[store-paste] Using authenticated client:', !!authenticatedUserId);
    console.log('[store-paste] ===================================');
    
    const { error, data } = await dbClient.from('pastes').insert(insertData);
    
    if (error) {
      console.error('[store-paste] Database insert error:', error);
    } else {
      console.log('[store-paste] Database insert successful, inserted ID:', insertData.id);
    }

    if (error) {
      // Log detailed error information for debugging
      secureLogError('Database error in store-paste', {
        error: error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        insertDataKeys: Object.keys(insertData),
        authenticatedUserId: authenticatedUserId,
        userId: userId,
        pasteId: id,
      });
      
      // In development, return more detailed error information
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorMessage = isDevelopment 
        ? `Failed to insert paste into database: ${error.message}${error.hint ? ` (${error.hint})` : ''}`
        : 'Failed to insert paste into database';
      
      return generateResponse(
        500,
        {
          message: errorMessage,
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
  // Allow custom headers: X-Platform, X-Hostname, X-CSRF-Token, Authorization
  return corsOptionsResponse(
    request, 
    'POST, OPTIONS',
    'Content-Type, X-Platform, X-Hostname, X-CSRF-Token, Authorization'
  );
}
