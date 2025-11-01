import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';

/**
 * @swagger
 * /api/store-paste:
 *   post:
 *     summary: Store paste (Legacy)
 *     description: Legacy compatibility endpoint that redirects to /api/v1/store-paste. Maintains compatibility with VSCode extension.
 *     deprecated: true
 *     tags:
 *       - Legacy
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StorePasteRequest'
 *     responses:
 *       200:
 *         description: Redirects to /api/v1/store-paste
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  // Create a new request to the v1 endpoint
  const body = await request.json();
  const url = new URL('/api/v1/store-paste', request.url);
  
  // Forward the request to v1
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response;
}

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
