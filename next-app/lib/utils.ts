import { getCorsHeaders } from './cors';
import type { NextRequest } from 'next/server';

/**
 * Generate a UUID v4 identifier
 * @returns UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generatePasteId(): string {
  // Generate UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a random banter comment/joke
 * @returns A random programming joke
 */
export function generateBanterComment(): string {
  const comments = [
    "Debugging is like being a detective in a mystery movie where you're also the murderer.",
    "Why do programmers prefer dark mode? Less bright light when staring at their screen for hours.",
    "Debugging is like trying to find a needle in a haystack, except the needle is also made of hay.",
    "Why do developers always mix up Halloween and Christmas? Because Oct 31 equals Dec 25.",
    "Why was the JavaScript developer sad? He didn't know how to 'null'.",
    "Why do programmers always mix up Thanksgiving and Christmas? Because Nov 25 equals Dec 25.",
  ];
  return comments[Math.floor(Math.random() * comments.length)];
}

/**
 * Sanitize error messages for client responses
 * In production, returns generic messages to prevent information disclosure
 * In development, returns detailed error messages for debugging
 * @param error - Error object or error message string
 * @param defaultMessage - Default generic message to return in production
 * @returns Sanitized error message safe for client consumption
 */
export function sanitizeError(error: any, defaultMessage: string = 'An error occurred'): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, never expose detailed error information
  if (isProduction) {
    // Log the full error server-side for debugging
    console.error('Error details (not exposed to client):', error);
    return defaultMessage;
  }
  
  // In development, allow detailed errors for debugging
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return defaultMessage;
}

/**
 * Generate a standardized API response
 * @param statusCode - HTTP status code
 * @param message - Response message
 * @param data - Optional additional data
 * @param request - Optional NextRequest for CORS header generation
 * @returns Response object
 */
export function generateResponse(
  statusCode: number,
  message: any,
  data?: any,
  request?: NextRequest
): Response {
  const corsHeaders = request ? getCorsHeaders(request) : {};
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders,
  };

  const responseBody = JSON.stringify({ response: message });

  return new Response(responseBody, {
    status: statusCode,
    headers,
  });
}
