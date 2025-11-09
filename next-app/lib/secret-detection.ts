/**
 * Secret Detection Utility
 * 
 * Scans text content for common secrets and API keys that should not be shared publicly.
 * Detects patterns for AWS, GitHub, Slack, and other common service credentials.
 * 
 * Patterns are based on industry-standard detection rules from:
 * - GitGuardian
 * - TruffleHog
 * - Gitleaks
 * - Secrets Patterns DB (https://github.com/mazen160/secrets-patterns-db)
 * 
 * Supports detection of 30+ secret types commonly used by developers.
 */

export interface DetectedSecret {
  /**
   * Type of secret detected (e.g., 'aws', 'github', 'slack')
   */
  type: string;
  /**
   * Human-readable description of the secret type
   */
  description: string;
  /**
   * The matched secret value (may be partially redacted for display)
   */
  value: string;
  /**
   * Starting position of the secret in the text
   */
  startIndex: number;
  /**
   * Ending position of the secret in the text
   */
  endIndex: number;
  /**
   * Line number where the secret was found (1-indexed)
   */
  lineNumber: number;
  /**
   * Column number where the secret starts (1-indexed)
   */
  columnNumber: number;
}

/**
 * Secret pattern definition
 */
interface SecretPattern {
  /**
   * Unique identifier for the secret type
   */
  type: string;
  /**
   * Human-readable description
   */
  description: string;
  /**
   * Regex pattern to detect the secret
   */
  pattern: RegExp;
  /**
   * Severity level (high, medium, low)
   */
  severity: 'high' | 'medium' | 'low';
}

/**
 * Common secret patterns to detect
 * Based on industry-standard patterns from GitGuardian, TruffleHog, Gitleaks, and Secrets Patterns DB
 */
const SECRET_PATTERNS: SecretPattern[] = [
  // AWS Access Keys (multiple prefixes: AKIA, A3T, AGPA, AIDA, AROA, AIPA, ANPA, ANVA, ASIA)
  {
    type: 'aws-access-key',
    description: 'AWS Access Key ID',
    pattern: /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/gi,
    severity: 'high',
  },
  // AWS Secret Access Keys (40 characters, base64-like)
  // Note: This may have some false positives, but it's better to catch potential secrets
  {
    type: 'aws-secret-key',
    description: 'AWS Secret Access Key',
    pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
    severity: 'high',
  },
  // AWS Session Tokens
  {
    type: 'aws-session-token',
    description: 'AWS Session Token',
    pattern: /\b[A-Za-z0-9/+=]{100,}\b/g,
    severity: 'high',
  },
  // GitHub Personal Access Tokens (ghp_ prefix)
  {
    type: 'github-token',
    description: 'GitHub Personal Access Token',
    pattern: /\bghp_[0-9a-zA-Z]{36}\b/gi,
    severity: 'high',
  },
  // GitHub OAuth Tokens (gho_ prefix)
  {
    type: 'github-oauth',
    description: 'GitHub OAuth Token',
    pattern: /\bgho_[0-9a-zA-Z]{36}\b/gi,
    severity: 'high',
  },
  // GitHub User-to-Server Tokens (ghu_ prefix)
  {
    type: 'github-user-token',
    description: 'GitHub User-to-Server Token',
    pattern: /\bghu_[0-9a-zA-Z]{36}\b/gi,
    severity: 'high',
  },
  // GitHub Server-to-Server Tokens (ghs_ prefix)
  {
    type: 'github-server-token',
    description: 'GitHub Server-to-Server Token',
    pattern: /\bghs_[0-9a-zA-Z]{36}\b/gi,
    severity: 'high',
  },
  // GitHub Refresh Tokens (ghr_ prefix)
  {
    type: 'github-refresh-token',
    description: 'GitHub Refresh Token',
    pattern: /\bghr_[0-9a-zA-Z]{36}\b/gi,
    severity: 'high',
  },
  // Slack Tokens (more specific pattern)
  {
    type: 'slack-token',
    description: 'Slack API Token',
    pattern: /\bxox[bapors]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,34}\b/gi,
    severity: 'high',
  },
  // Slack Webhooks
  {
    type: 'slack-webhook',
    description: 'Slack Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/gi,
    severity: 'high',
  },
  // Google API Keys
  {
    type: 'google-api-key',
    description: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/gi,
    severity: 'high',
  },
  // Google OAuth Access Tokens
  {
    type: 'google-oauth-token',
    description: 'Google OAuth Access Token',
    pattern: /\bya29\.[0-9A-Za-z\-_]+/gi,
    severity: 'high',
  },
  // Stripe API Keys (Live and Test)
  {
    type: 'stripe-key',
    description: 'Stripe API Key',
    pattern: /\b(sk|pk)_(live|test)_[0-9a-zA-Z]{24,}\b/gi,
    severity: 'high',
  },
  // Twilio API Keys
  {
    type: 'twilio-key',
    description: 'Twilio API Key',
    pattern: /\bSK[0-9a-fA-F]{32}\b/gi,
    severity: 'high',
  },
  // SendGrid API Keys
  {
    type: 'sendgrid-key',
    description: 'SendGrid API Key',
    pattern: /\bSG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}\b/gi,
    severity: 'high',
  },
  // Mailgun API Keys
  {
    type: 'mailgun-key',
    description: 'Mailgun API Key',
    pattern: /\bkey-[0-9a-zA-Z]{32}\b/gi,
    severity: 'high',
  },
  // Azure Shared Access Signature (SAS) Tokens
  {
    type: 'azure-sas-token',
    description: 'Azure SAS Token',
    pattern: /\bsig=[A-Za-z0-9%]+/gi,
    severity: 'high',
  },
  // Facebook Access Tokens
  {
    type: 'facebook-token',
    description: 'Facebook Access Token',
    pattern: /\bEAACEdEose0cBA[0-9A-Za-z]+/gi,
    severity: 'high',
  },
  // PayPal/Braintree Access Tokens
  {
    type: 'paypal-token',
    description: 'PayPal/Braintree Access Token',
    pattern: /\baccess_token\$(production|sandbox)\$[0-9a-z]{16}\$[0-9a-f]{32}\b/gi,
    severity: 'high',
  },
  // Square Access Tokens
  {
    type: 'square-token',
    description: 'Square Access Token',
    pattern: /\bsq0atp-[0-9A-Za-z\-_]{22}\b/gi,
    severity: 'high',
  },
  // Heroku API Keys (more specific - look for heroku context)
  {
    type: 'heroku-key',
    description: 'Heroku API Key',
    pattern: /\b(heroku[_-]?api[_-]?key|HEROKU_API_KEY)\s*[=:]\s*['"]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"]?/gi,
    severity: 'high',
  },
  // Discord Bot Tokens
  {
    type: 'discord-token',
    description: 'Discord Bot Token',
    pattern: /\b(MTA|MTk|Mz)[A-Za-z0-9\-_]{23}\.[A-Za-z0-9\-_]{6}\.[A-Za-z0-9\-_]{27,38}\b/gi,
    severity: 'high',
  },
  // Telegram Bot Tokens
  {
    type: 'telegram-token',
    description: 'Telegram Bot Token',
    pattern: /\b\d{8,10}:[A-Za-z0-9\-_]{35}\b/gi,
    severity: 'high',
  },
  // Firebase Service Account Keys (JSON structure)
  {
    type: 'firebase-key',
    description: 'Firebase Service Account Key',
    pattern: /"type"\s*:\s*"service_account"[\s\S]{0,2000}"private_key"/gi,
    severity: 'high',
  },
  // Private Keys (RSA, SSH, etc.)
  {
    type: 'private-key',
    description: 'Private Key (RSA/SSH)',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
    severity: 'high',
  },
  // SSH Private Keys
  {
    type: 'ssh-private-key',
    description: 'SSH Private Key',
    pattern: /-----BEGIN\s+(?:DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/gi,
    severity: 'high',
  },
  // Database Connection Strings (more comprehensive)
  {
    type: 'database-connection',
    description: 'Database Connection String',
    pattern: /(?:mysql|postgresql|mongodb|redis|sqlserver|postgres|mssql|oracle):\/\/[^\s"'<>]+/gi,
    severity: 'high',
  },
  // MongoDB Connection Strings (specific pattern)
  {
    type: 'mongodb-connection',
    description: 'MongoDB Connection String',
    pattern: /mongodb(\+srv)?:\/\/[^\s"'<>]+/gi,
    severity: 'high',
  },
  // PostgreSQL Connection Strings (with password)
  {
    type: 'postgres-connection',
    description: 'PostgreSQL Connection String',
    pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@[^\s"'<>]+/gi,
    severity: 'high',
  },
  // JWT Tokens (may be false positives, but worth flagging)
  {
    type: 'jwt-token',
    description: 'JWT Token',
    pattern: /\beyJ[A-Za-z0-9\-_=]+\.eyJ[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*\b/gi,
    severity: 'medium',
  },
  // Generic API Keys (common patterns)
  {
    type: 'generic-api-key',
    description: 'Generic API Key',
    pattern: /\b(api[_-]?key|apikey|access[_-]?token|secret[_-]?key)\s*[=:]\s*['"]?([A-Za-z0-9\-_]{20,})['"]?/gi,
    severity: 'medium',
  },
  // OAuth Tokens
  {
    type: 'oauth-token',
    description: 'OAuth Token',
    pattern: /\b(oauth[_-]?token|bearer[_-]?token)\s*[=:]\s*['"]?([A-Za-z0-9\-_]{20,})['"]?/gi,
    severity: 'medium',
  },
  // DigitalOcean API Tokens
  {
    type: 'digitalocean-token',
    description: 'DigitalOcean API Token',
    pattern: /\bdoo_v1_[a-f0-9]{64}\b/gi,
    severity: 'high',
  },
  // Cloudflare API Tokens (more specific - look for cloudflare context)
  {
    type: 'cloudflare-token',
    description: 'Cloudflare API Token',
    pattern: /\b(cloudflare[_-]?api[_-]?token|CF_API_TOKEN|CLOUDFLARE_API_TOKEN)\s*[=:]\s*['"]?([0-9a-f]{40})['"]?/gi,
    severity: 'high',
  },
  // OpenAI API Keys (sk- prefix, but different from Stripe which uses sk_live_/sk_test_)
  {
    type: 'openai-key',
    description: 'OpenAI API Key',
    pattern: /\b(openai[_-]?api[_-]?key|OPENAI_API_KEY)\s*[=:]\s*['"]?(sk-[a-zA-Z0-9]{32,})['"]?|\bsk-[a-zA-Z0-9]{48,}\b/gi,
    severity: 'high',
  },
  // Generic Secret Keys (high entropy strings)
  {
    type: 'generic-secret',
    description: 'Generic Secret Key',
    pattern: /\b(secret|password|passwd|pwd|token|key)\s*[=:]\s*['"]?([A-Za-z0-9\-_+/=]{32,})['"]?/gi,
    severity: 'medium',
  },
];

/**
 * Calculate line and column numbers from text index
 * @param text - The full text content
 * @param index - Character index in the text
 * @returns Object with lineNumber and columnNumber (1-indexed)
 */
function getLineAndColumn(text: string, index: number): { lineNumber: number; columnNumber: number } {
  const beforeIndex = text.substring(0, index);
  const lines = beforeIndex.split('\n');
  const lineNumber = lines.length;
  const columnNumber = lines[lines.length - 1].length + 1;
  return { lineNumber, columnNumber };
}

/**
 * Redact a secret value for display (shows first 4 and last 4 characters)
 * @param value - The secret value to redact
 * @returns Redacted version of the secret
 */
function redactSecret(value: string): string {
  if (value.length <= 12) {
    return '*'.repeat(value.length);
  }
  const start = value.substring(0, 4);
  const end = value.substring(value.length - 4);
  const middle = '*'.repeat(Math.min(value.length - 8, 20));
  return `${start}${middle}${end}`;
}

/**
 * Scan text content for secrets
 * @param text - The text content to scan
 * @returns Array of detected secrets
 */
export function detectSecrets(text: string): DetectedSecret[] {
  const detected: DetectedSecret[] = [];
  const seenPositions = new Set<string>(); // Track positions to avoid duplicates

  // First pass: detect private keys and other high-priority secrets
  // We'll use this to exclude false positives from generic patterns
  const privateKeyRanges: Array<{ start: number; end: number }> = [];
  const privateKeyPatterns = [
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
    /-----BEGIN\s+(?:DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/gi,
  ];

  for (const pattern of privateKeyPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      if (match.index !== undefined) {
        privateKeyRanges.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern.pattern));
    
    for (const match of matches) {
      if (!match.index && match.index !== 0) continue;
      
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      const positionKey = `${startIndex}-${endIndex}`;
      
      // Skip if we've already detected a secret at this position
      if (seenPositions.has(positionKey)) continue;
      
      // Skip AWS secret key matches that are within private key blocks
      // This prevents false positives when SSH/private keys contain base64 data
      if (pattern.type === 'aws-secret-key' || pattern.type === 'aws-session-token') {
        const isInPrivateKey = privateKeyRanges.some(
          range => startIndex >= range.start && endIndex <= range.end
        );
        if (isInPrivateKey) {
          continue; // Skip this match - it's part of a private key
        }
      }
      
      seenPositions.add(positionKey);
      
      const { lineNumber, columnNumber } = getLineAndColumn(text, startIndex);
      const value = match[0];
      
      detected.push({
        type: pattern.type,
        description: pattern.description,
        value: redactSecret(value),
        startIndex,
        endIndex,
        lineNumber,
        columnNumber,
      });
    }
  }

  // Sort by line number, then by column number
  return detected.sort((a, b) => {
    if (a.lineNumber !== b.lineNumber) {
      return a.lineNumber - b.lineNumber;
    }
    return a.columnNumber - b.columnNumber;
  });
}

/**
 * Check if text contains any secrets
 * @param text - The text content to check
 * @returns True if secrets are detected, false otherwise
 */
export function hasSecrets(text: string): boolean {
  return detectSecrets(text).length > 0;
}

/**
 * Redact secrets from text content
 * @param text - The text content to redact
 * @returns Object with redacted text and list of redacted secrets
 */
export function redactSecrets(text: string): { redactedText: string; redactedSecrets: DetectedSecret[] } {
  const secrets = detectSecrets(text);
  let redactedText = text;
  
  // Sort by position in reverse order to maintain indices when replacing
  const sortedSecrets = [...secrets].sort((a, b) => b.startIndex - a.startIndex);
  
  for (const secret of sortedSecrets) {
    const originalMatch = text.substring(secret.startIndex, secret.endIndex);
    const redacted = '*'.repeat(originalMatch.length);
    redactedText = 
      redactedText.substring(0, secret.startIndex) + 
      redacted + 
      redactedText.substring(secret.endIndex);
  }
  
  return { redactedText, redactedSecrets: secrets };
}

/**
 * Get a summary of detected secrets for display
 * @param secrets - Array of detected secrets
 * @returns Summary string
 */
export function getSecretsSummary(secrets: DetectedSecret[]): string {
  if (secrets.length === 0) {
    return 'No secrets detected.';
  }
  
  const byType = secrets.reduce((acc, secret) => {
    acc[secret.type] = (acc[secret.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const summary = Object.entries(byType)
    .map(([type, count]) => {
      const pattern = SECRET_PATTERNS.find(p => p.type === type);
      return `${pattern?.description || type}: ${count}`;
    })
    .join(', ');
  
  return `Detected ${secrets.length} potential secret(s): ${summary}`;
}

