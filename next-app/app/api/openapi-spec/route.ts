import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/openapi-spec';

/**
 * GET /api/openapi-spec
 * Serves the OpenAPI/Swagger specification as JSON
 * Used by the Portal Docs UI
 */
export async function GET() {
  return NextResponse.json(swaggerSpec);
}

