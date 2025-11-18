const DEFAULT_VSCODE_CALLBACK_URI = 'vscode://JohnStilia.pasteportal/auth-callback';

/**
 * Returns the VS Code callback URI from environment or falls back to default.
 */
export function getVSCodeCallbackUri(): string {
  const envValue = process.env.NEXT_PUBLIC_VSCODE_CALLBACK_URI?.trim();
  return envValue ? envValue : DEFAULT_VSCODE_CALLBACK_URI;
}

/**
 * Builds the VS Code callback URI with optional query parameters.
 * @param query Query string or URLSearchParams to append to the base URI.
 */
export function buildVSCodeCallbackUri(query?: string | URLSearchParams): string {
  const baseUri = getVSCodeCallbackUri();

  if (!query) {
    return baseUri;
  }

  if (query instanceof URLSearchParams) {
    const queryString = query.toString();
    return queryString ? `${baseUri}?${queryString}` : baseUri;
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return baseUri;
  }

  return trimmedQuery.startsWith('?')
    ? `${baseUri}${trimmedQuery}`
    : `${baseUri}?${trimmedQuery}`;
}


