import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption';
import {
  generateBanterComment,
  generateResponse,
  sanitizeError,
  secureLogError,
  validateInputLength,
} from '@/lib/utils';
import { corsOptionsResponse } from '@/lib/cors';
import { applyRateLimit, rateLimitConfigs } from '@/lib/rate-limit';

/**
 * @swagger
 * /api/v1/get-paste:
 *   get:
 *     summary: Retrieve a paste by ID
 *     description: Public endpoint to retrieve a paste by its ID. No authentication required.
 *     tags:
 *       - Public
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
 *         description: Paste successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PasteResponse'
 *       400:
 *         description: Invalid or missing paste ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PasteResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PasteResponse'
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (public endpoint, use default config)
    const rateLimitResponse = applyRateLimit(request, rateLimitConfigs.default);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Get ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const rawId = searchParams.get('id');

    // Validate ID exists and length
    if (!rawId) {
      return generateResponse(
        400,
        {
          message: 'The paste was unsuccessfully retrieved from the database. Parameter is not correct',
          joke: generateBanterComment(),
        },
        undefined,
        request
      );
    }

    // Sanitize and validate ID length (UUID v4 max 36 chars, legacy hex max 6 chars)
    const idValidation = validateInputLength(rawId, 36, 6);
    if (!idValidation.isValid) {
      return generateResponse(
        400,
        {
          message: 'Invalid paste ID format or length',
          joke: generateBanterComment(),
        },
        undefined,
        request
      );
    }
    
    const id = idValidation.sanitized;
    
    // Validate ID format (UUID v4 or legacy 6-character hex)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const legacyRegex = /^[a-fA-F0-9]{6}$/;
    
    if (!uuidRegex.test(id) && !legacyRegex.test(id)) {
      return generateResponse(
        400,
        {
          message: 'The paste was unsuccessfully retrieved from the database. Parameter is not correct',
          joke: generateBanterComment(),
        },
        undefined,
        request
      );
    }

    // Query Supabase - exclude password field for security
    // Password field should only be accessible through authenticated list-pastes endpoint
    const { data, error } = await supabase
      .from('pastes')
      .select('id, paste, recipient_gh_username, timestamp, created_at, is_password_encrypted, user_id, name')
      .eq('id', id)
      .single();

    if (error || !data) {
      return generateResponse(
        400,
        {
          message: 'The paste was unsuccessfully retrieved from the database',
          id: 'Not Found',
          joke: generateBanterComment(),
        },
        undefined,
        request
      );
    }

    // Validate that paste field exists and is not null/undefined
    if (!data.paste || typeof data.paste !== 'string') {
      secureLogError('Paste field is missing or invalid in database', { 
        pasteId: id, 
        hasPaste: !!data.paste, 
        pasteType: typeof data.paste 
      });
      return generateResponse(
        500,
        {
          message: 'Paste content is missing or invalid in database',
          joke: generateBanterComment(),
        },
        undefined,
        request
      );
    }

    // Decrypt the paste content
    let decryptedPaste: string;
    try {
      decryptedPaste = decrypt(data.paste);
      
      // Validate decrypted content is not empty
      if (!decryptedPaste || typeof decryptedPaste !== 'string') {
        secureLogError('Decrypted paste is empty or invalid', { 
          pasteId: id, 
          hasDecryptedPaste: !!decryptedPaste, 
          decryptedPasteType: typeof decryptedPaste 
        });
        return generateResponse(
          500,
          {
            message: 'Paste content is empty after decryption',
            joke: generateBanterComment(),
          },
          undefined,
          request
        );
      }
    } catch (decryptError) {
      secureLogError('Decryption error in get-paste', decryptError);
      return generateResponse(
        500,
        {
          message: sanitizeError(decryptError, 'Failed to decrypt paste'),
          joke: generateBanterComment(),
        },
        undefined,
        request
      );
    }

    // Return success response
    return generateResponse(
      200,
      {
        message: 'The paste was successfully retrieved from the database',
        id: data.id,
        paste: decryptedPaste,
        joke: generateBanterComment(),
        recipient_gh_username: data.recipient_gh_username,
        is_password_encrypted: data.is_password_encrypted || false,
        name: data.name || null,
      },
      undefined,
      request
    );
  } catch (error: any) {
    secureLogError('Error in get-paste', error);
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
  return corsOptionsResponse(request, 'GET, OPTIONS');
}
