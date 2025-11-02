import { NextRequest } from 'next/server';

/**
 * @swagger
 * /api/get-paste:
 *   get:
 *     summary: Get paste (Legacy)
 *     description: Legacy compatibility endpoint that redirects to /api/v1/get-paste.
 *     deprecated: true
 *     tags:
 *       - Legacy
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Paste ID (UUID v4 or 6-character hex)
 *     responses:
 *       200:
 *         description: Redirects to /api/v1/get-paste
 *       400:
 *         description: Invalid or missing paste ID
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  // Forward the request to v1 with query parameters
  const searchParams = request.nextUrl.searchParams;
  const url = new URL('/api/v1/get-paste', request.url);
  url.search = searchParams.toString();
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response;
}

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
