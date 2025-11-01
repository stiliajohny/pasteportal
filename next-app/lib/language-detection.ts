/**
 * Language detection utility for syntax highlighting
 * Automatically detects programming languages from content patterns
 */

/**
 * Supported languages for syntax highlighting
 */
export const SUPPORTED_LANGUAGES = [
  { value: 'text', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'scala', label: 'Scala' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash/Shell' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'ini', label: 'INI' },
] as const;

export type LanguageValue = typeof SUPPORTED_LANGUAGES[number]['value'];

/**
 * Detect language from file extension
 */
export const detectLanguageFromExtension = (filename: string): LanguageValue | null => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  const extensionMap: Record<string, LanguageValue> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'c': 'c',
    'h': 'c',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'md': 'markdown',
    'markdown': 'markdown',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'ps1': 'powershell',
    'dockerfile': 'dockerfile',
    'ini': 'ini',
    'conf': 'ini',
  };

  return extensionMap[ext] || null;
};

/**
 * Detect language from content patterns
 */
export const detectLanguageFromContent = (content: string): LanguageValue => {
  if (!content || content.trim().length === 0) {
    return 'text';
  }

  const trimmedContent = content.trim();
  const firstLine = trimmedContent.split('\n')[0] || '';

  // Shebang detection
  if (firstLine.startsWith('#!')) {
    if (firstLine.includes('python')) return 'python';
    if (firstLine.includes('node')) return 'javascript';
    if (firstLine.includes('bash') || firstLine.includes('sh')) return 'bash';
    if (firstLine.includes('ruby')) return 'ruby';
    if (firstLine.includes('perl')) return 'text'; // perl not in our list
  }

  // HTML detection
  if (/^<\s*!DOCTYPE\s+html/i.test(trimmedContent) || /^<\s*html/i.test(trimmedContent)) {
    return 'html';
  }

  // XML detection
  if (/^<\s*\?xml/i.test(trimmedContent)) {
    return 'xml';
  }

  // JSON detection
  if ((trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) && 
      (trimmedContent.endsWith('}') || trimmedContent.endsWith(']'))) {
    try {
      JSON.parse(trimmedContent);
      return 'json';
    } catch {
      // Not valid JSON, continue
    }
  }

  // YAML detection
  if (/^---\s*$/.test(firstLine) || /^[\w-]+:\s*[\w-]+/.test(firstLine)) {
    return 'yaml';
  }

  // SQL detection
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|INNER|OUTER|LEFT|RIGHT)\b/i.test(trimmedContent)) {
    return 'sql';
  }

  // TypeScript/TSX detection
  if (/import\s+.*from\s+['"]/.test(trimmedContent)) {
    if (/\.tsx?['"]/.test(trimmedContent) || /<[A-Z]/.test(trimmedContent)) {
      return /<[A-Z]/.test(trimmedContent) ? 'tsx' : 'typescript';
    }
  }

  // JSX detection
  if (/import\s+React/.test(trimmedContent) || /<[A-Z]/.test(trimmedContent)) {
    return 'jsx';
  }

  // JavaScript detection
  if (/function\s+\w+\s*\(|const\s+\w+\s*=\s*\(|let\s+\w+\s*=\s*\(|var\s+\w+\s*=\s*\(|=>/.test(trimmedContent) ||
      /require\(|module\.exports|export\s+/.test(trimmedContent)) {
    return 'javascript';
  }

  // Python detection
  if (/^def\s+\w+\s*\(|^class\s+\w+|^import\s+\w+|^from\s+\w+\s+import/.test(trimmedContent) ||
      /print\s*\(|if\s+__name__\s*==\s*['"]__main__/.test(trimmedContent)) {
    return 'python';
  }

  // Java detection
  if (/public\s+class\s+\w+|public\s+static\s+void\s+main|package\s+\w+/.test(trimmedContent)) {
    return 'java';
  }

  // C/C++ detection
  if (/^#include\s*<|^#include\s*["']/.test(trimmedContent) || 
      /int\s+main\s*\(|void\s+main\s*\(/.test(trimmedContent)) {
    return /iostream|string|vector|std::/.test(trimmedContent) ? 'cpp' : 'c';
  }

  // Go detection
  if (/^package\s+\w+|func\s+main\s*\(/.test(trimmedContent)) {
    return 'go';
  }

  // Rust detection
  if (/^fn\s+\w+|^use\s+std::|^pub\s+fn/.test(trimmedContent)) {
    return 'rust';
  }

  // PHP detection
  if (/^<\?php|^<\?=/.test(trimmedContent)) {
    return 'php';
  }

  // Ruby detection
  if (/^require\s+['"]|^def\s+\w+|^class\s+\w+/.test(trimmedContent) && 
      !/^def\s+\w+\s*\(/.test(trimmedContent)) { // Different from Python
    return 'ruby';
  }

  // CSS detection
  if (/\{[^}]*:\s*[^}]*\}/.test(trimmedContent) && /\.\w+|#\w+|@\w+/.test(trimmedContent)) {
    return 'css';
  }

  // Markdown detection
  if (/^#+\s+\w+|^-\s+\w+|^\*\s+\w+|^\d+\.\s+\w+/.test(trimmedContent) ||
      /\[.*\]\(.*\)/.test(trimmedContent)) {
    return 'markdown';
  }

  // Dockerfile detection
  if (/^FROM\s+\w+|^RUN\s+|^COPY\s+|^WORKDIR\s+/.test(trimmedContent)) {
    return 'dockerfile';
  }

  return 'text';
};

/**
 * Auto-detect language from filename and/or content
 */
export const autoDetectLanguage = (
  content: string,
  filename?: string
): LanguageValue => {
  // Try filename first
  if (filename) {
    const langFromExt = detectLanguageFromExtension(filename);
    if (langFromExt) {
      return langFromExt;
    }
  }

  // Fall back to content detection
  return detectLanguageFromContent(content);
};




