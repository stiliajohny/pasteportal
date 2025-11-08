/**
 * Client-side CSRF token management
 * Provides utilities to read CSRF tokens from cookies and include them in requests
 */

/**
 * Get CSRF token from cookie
 * @returns CSRF token string or null if not found
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  // Read token from cookie
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Include CSRF token in fetch request headers
 * Adds X-CSRF-Token header if token is available
 * Also adds Authorization header with Bearer token if accessToken is provided
 * @param url - Request URL
 * @param options - Fetch options
 * @param accessToken - Optional Supabase access token for authentication
 * @returns Fetch response
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<Response> {
  const token = getCsrfToken();
  
  // Clone headers to avoid mutating the original
  const headers = new Headers(options.headers);
  
  // Add CSRF token if available
  if (token) {
    headers.set('X-CSRF-Token', token);
  }
  
  // Add Authorization header with Bearer token if access token is provided
  // This allows the server to authenticate the user even if cookies aren't available
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  // Ensure credentials are included for cookie-based auth
  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });
}

/**
 * Get headers object with CSRF token
 * Useful for adding to existing headers object
 * @param existingHeaders - Optional existing headers object
 * @returns Headers object with CSRF token included
 */
export function getHeadersWithCsrf(existingHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getCsrfToken();
  const headers = { ...existingHeaders };
  
  if (token) {
    headers['X-CSRF-Token'] = token;
  }
  
  return headers;
}

