import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

/**
 * OpenAPI/Swagger specification generator for PastePortal API
 */

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PastePortal API',
      version: '1.0.0',
      description: 'PastePortal API Documentation - Share text snippets securely with encryption',
      contact: {
        name: 'PastePortal API Support',
        url: 'https://pasteportal.app',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://pasteportal.app',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sb-access-token',
          description: 'Supabase session cookie for authenticated requests',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
          required: ['error'],
        },
        PasteResponse: {
          type: 'object',
          properties: {
            response: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Success or error message',
                },
                id: {
                  type: 'string',
                  description: 'Paste ID (UUID or 6-character hex)',
                },
                paste: {
                  type: 'string',
                  description: 'Decrypted paste content',
                },
                recipient_gh_username: {
                  type: 'string',
                  description: 'GitHub username of recipient',
                },
                is_password_encrypted: {
                  type: 'boolean',
                  description: 'Whether the paste is password-protected',
                },
                joke: {
                  type: 'string',
                  description: 'Random programming joke (for fun)',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp of paste creation',
                },
              },
            },
          },
        },
        StorePasteRequest: {
          type: 'object',
          required: ['paste', 'recipient_gh_username'],
          properties: {
            paste: {
              type: 'string',
              description: 'The paste content to store',
              maxLength: 409600,
            },
            recipient_gh_username: {
              type: 'string',
              description: 'GitHub username of the recipient',
            },
            name: {
              type: 'string',
              description: 'Optional name/title for the paste (requires authentication)',
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID (requires authentication, must match authenticated user)',
            },
            password: {
              type: 'string',
              description: 'Password for password-protected paste (requires authentication)',
            },
          },
        },
        StorePasteResponse: {
          type: 'object',
          properties: {
            response: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                },
                id: {
                  type: 'string',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
                paste: {
                  type: 'string',
                },
                joke: {
                  type: 'string',
                },
                raw_data: {
                  type: 'string',
                },
              },
            },
          },
        },
        ListPastesResponse: {
          type: 'object',
          properties: {
            pastes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                    nullable: true,
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                  },
                  created_at: {
                    type: 'string',
                    format: 'date-time',
                  },
                  is_password_encrypted: {
                    type: 'boolean',
                  },
                  password: {
                    type: 'string',
                    nullable: true,
                    description: 'Decrypted password (only for user\'s own pastes)',
                  },
                  display_name: {
                    type: 'string',
                  },
                },
              },
            },
            count: {
              type: 'integer',
            },
          },
        },
        DeleteAccountResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Public',
        description: 'Public endpoints - no authentication required',
      },
      {
        name: 'Authenticated',
        description: 'Endpoints that require user authentication',
      },
      {
        name: 'Legacy',
        description: 'Legacy endpoints for backward compatibility',
      },
    ],
  },
  apis: [
    path.join(process.cwd(), 'app', 'api', '**', '*.ts'),
    path.join(process.cwd(), 'app', 'api', '**', 'route.ts'),
  ], // Path to API routes
};

export const swaggerSpec = swaggerJsdoc(options);

