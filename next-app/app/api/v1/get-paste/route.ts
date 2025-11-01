import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption';
import { generateBanterComment, generateResponse, sanitizeError } from '@/lib/utils';

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
    // Get ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Validate ID
    if (!id) {
      return generateResponse(
        400,
        {
          message: 'The paste was unsuccessfully retrieved from the database. Parameter is not correct',
          joke: generateBanterComment(),
        }
      );
    }

    // Validate ID format (UUID v4 or legacy 6-character hex)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const legacyRegex = /^[a-fA-F0-9]{6}$/;
    
    if (!uuidRegex.test(id) && !legacyRegex.test(id)) {
      return generateResponse(
        400,
        {
          message: 'The paste was unsuccessfully retrieved from the database. Parameter is not correct',
          joke: generateBanterComment(),
        }
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
        }
      );
    }

    // Decrypt the paste content
    let decryptedPaste: string;
    try {
      decryptedPaste = decrypt(data.paste);
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      return generateResponse(
        500,
        {
          message: sanitizeError(decryptError, 'Failed to decrypt paste'),
          joke: generateBanterComment(),
        }
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
      }
    );
  } catch (error: any) {
    console.error('Error in get-paste:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
