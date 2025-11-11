/**
 * Environment variable validation and configuration
 * Validates all required environment variables on module load
 * Throws errors if critical variables are missing or invalid
 */

interface Config {
  encryptionKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  nodeEnv: 'development' | 'production' | 'test';
  allowedOrigins: string[];
  siteUrl?: string;
  enablePwaDev?: boolean;
}

/**
 * Validate encryption key format
 * @param key - Encryption key from environment
 * @returns True if key is valid
 */
function validateEncryptionKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Key should be either 64 hex characters (32 bytes) or any string (will be derived via scrypt)
  if (key.length === 64) {
    // If 64 chars, must be valid hex
    return /^[0-9a-fA-F]{64}$/.test(key);
  }
  
  // Otherwise, any non-empty string is valid (will be derived)
  return key.length > 0;
}

/**
 * Validate Supabase URL format
 * @param url - Supabase URL from environment
 * @returns True if URL is valid
 */
function validateSupabaseUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a value appears to be a placeholder
 * @param value - Value to check
 * @returns True if value looks like a placeholder
 */
function isPlaceholderValue(value: string): boolean {
  const placeholderPatterns = [
    /^your-.*-here$/i,
    /^placeholder/i,
    /^change-this/i,
    /^example/i,
    /^your-project/i,
    /^your-supabase/i,
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(value));
}

/**
 * Validate Supabase anon key format (JWT-like structure)
 * @param key - Supabase anon key from environment
 * @returns True if key appears valid
 */
function validateSupabaseKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Check for placeholder values
  if (isPlaceholderValue(key)) {
    return false;
  }
  
  // Supabase keys are typically long base64-like strings
  // Minimum reasonable length check
  return key.length > 50;
}

/**
 * Parse and validate allowed origins from environment
 * @param originsEnv - Comma-separated origins from environment
 * @returns Array of validated origin URLs
 */
function parseAllowedOrigins(originsEnv?: string): string[] {
  if (!originsEnv) {
    return [];
  }
  
  return originsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => {
      if (!origin) return false;
      
      // Allow wildcard or full URLs
      try {
        // Try parsing as URL
        const url = new URL(origin);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        // Allow hostname-only entries (will be validated during CORS check)
        return origin.length > 0 && !origin.includes(' ');
      }
    });
}

/**
 * Get and validate all configuration from environment variables
 * @returns Validated configuration object
 * @throws Error if any required variable is missing or invalid
 */
export function getConfig(): Config {
  // Required environment variables
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Validation errors
  const errors: string[] = [];
  
  // Validate encryption key
  if (!encryptionKey) {
    errors.push('ENCRYPTION_KEY environment variable is required');
  } else if (isPlaceholderValue(encryptionKey)) {
    errors.push('ENCRYPTION_KEY appears to be a placeholder value. Please set a secure encryption key (64-character hex string or any non-empty string).');
  } else if (!validateEncryptionKey(encryptionKey)) {
    errors.push('ENCRYPTION_KEY must be a valid 64-character hex string or a non-empty string for key derivation');
  }
  
  // Validate Supabase URL
  if (!supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  } else if (isPlaceholderValue(supabaseUrl)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL appears to be a placeholder value. Please set a real Supabase URL from your Supabase project settings.');
  } else if (!validateSupabaseUrl(supabaseUrl)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL');
  }
  
  // Validate Supabase anon key
  if (!supabaseAnonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
  } else if (isPlaceholderValue(supabaseAnonKey)) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be a placeholder value. Please set a real Supabase anon key from your Supabase project settings.');
  } else if (!validateSupabaseKey(supabaseAnonKey)) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid (too short). Supabase keys are typically 100+ characters long.');
  }
  
  // Validate NODE_ENV
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: development, production, test (got: ${nodeEnv})`);
  }
  
  // If any errors, throw immediately
  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n` +
      'Please check your .env file or environment variables.'
    );
  }
  
  // At this point, TypeScript doesn't know these are defined, but we've validated them above
  // Use non-null assertions since we've already validated they exist
  const validatedEncryptionKey: string = encryptionKey!;
  const validatedSupabaseUrl: string = supabaseUrl!;
  const validatedSupabaseAnonKey: string = supabaseAnonKey!;
  
  // Optional environment variables
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const enablePwaDev = process.env.ENABLE_PWA_DEV === 'true';
  
  return {
    encryptionKey: validatedEncryptionKey,
    supabaseUrl: validatedSupabaseUrl,
    supabaseAnonKey: validatedSupabaseAnonKey,
    nodeEnv: nodeEnv as 'development' | 'production' | 'test',
    allowedOrigins,
    siteUrl,
    enablePwaDev,
  };
}

/**
 * Validate configuration on module load
 * This ensures the app fails fast if configuration is invalid
 */
let config: Config | null = null;

/**
 * Get cached configuration or validate and cache it
 * @returns Validated configuration
 */
export function getValidatedConfig(): Config {
  if (!config) {
    config = getConfig();
  }
  return config;
}

// Validate on module load (server-side only)
if (typeof window === 'undefined') {
  try {
    config = getConfig();
  } catch (error) {
    // In development, log the error clearly
    if (process.env.NODE_ENV === 'development') {
      console.error('\n❌ Configuration Error:\n', error);
      console.error('\n💡 Tip: Copy .env.example to .env.local and update with your actual values.');
      console.error('   Get your Supabase credentials from: https://app.supabase.com/project/_/settings/api\n');
    }
    // Re-throw to prevent app from starting with invalid config
    throw error;
  }
}
