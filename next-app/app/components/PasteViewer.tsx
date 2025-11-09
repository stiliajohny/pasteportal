'use client';

import { fetchWithCsrf } from '@/lib/csrf-client';
import { autoDetectLanguage, LanguageValue, SUPPORTED_LANGUAGES } from '@/lib/language-detection';
import { decryptWithPassword, encryptWithPassword, generateRandomPassword } from '@/lib/password-encryption';
import { detectSecrets, DetectedSecret, redactSecrets, getSecretTags } from '@/lib/secret-detection';
import { sanitizePastedText } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAuth } from '../contexts/AuthContext';
import AuthDialog from './AuthDialog';
import SecretWarningDialog from './SecretWarningDialog';
import { useTheme } from './ThemeProvider';

// Dynamically import Editor component with SSR disabled to avoid Prism.js issues during build
const Editor = dynamic(
  () => import('react-simple-code-editor'),
  { ssr: false }
);

const API_BASE = '/api/v1';

/**
 * Map language values to Prism language identifiers
 */
const getPrismLanguage = (lang: LanguageValue): string => {
  const langMap: Record<LanguageValue, string> = {
    'text': 'plaintext',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'jsx': 'jsx',
    'tsx': 'tsx',
    'python': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'csharp': 'csharp',
    'go': 'go',
    'rust': 'rust',
    'php': 'php',
    'ruby': 'ruby',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'scala': 'scala',
    'html': 'markup',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'yaml': 'yaml',
    'xml': 'xml',
    'markdown': 'markdown',
    'sql': 'sql',
    'bash': 'bash',
    'powershell': 'powershell',
    'dockerfile': 'docker',
    'ini': 'ini',
  };
  return langMap[lang] || 'plaintext';
};

const introParagraph = `Welcome to PastePortal!

Are you tired of copying your code and losing all the syntax highlighting?
Now you can directly share your code snippets and the receiver will see them with beautiful syntax highlighting!

How to use it:

1. Paste your code in the text area below
2. Click "Push" to get a link
3. Share the link with your friends!

---

Coming soon: IDE Extensions!

We're working on extensions for VS Code, JetBrains IDEs, and Vim that will allow you to:
- Share code directly from your editor with a simple keyboard shortcut
- Access your pastes from the sidebar
- Retrieve pastes without leaving your IDE

Click "Get the Extension" in the header to register your interest and get notified when they're ready!

---

Why PastePortal was created:

As a DevOps engineer, I was constantly frustrated by sharing large code blocks in Slack. Those massive walls of text would break formatting, lose syntax highlighting, and make conversations hard to follow. I needed a better way to share code snippets that preserved readability and kept Slack conversations clean.
That's how PastePortal was born - a simple, fast way to share code with beautiful syntax highlighting, so you can keep your team communications focused and your code looking great.

---
`;

const loadingJokes = [
  "Hang on tight, we're fetching the info like a dog with a chew toy... Woof!",
  "Just a sec, bossing the servers around... Hang tight!",
  "Brewing up some fresh data, almost ready... hold please!",
  "Data dwarves are mining for information, almost there... Brace yourself!",
  "The info is on its way, like a superhero to save the day... Standby!",
  "Retrieving the goods, like a thief in the night... Just a moment!",
];

/**
 * Get a random loading joke for better UX
 * Follows Doherty Threshold: Keep users engaged during wait times
 */
function getRandomLoadingJoke(): string {
  return loadingJokes[Math.floor(Math.random() * loadingJokes.length)];
}

/**
 * Generate line numbers array from content
 * Returns array of line numbers (1, 2, 3, ...) based on content line count
 */
function getLineNumbers(content: string): number[] {
  if (!content) return [1];
  const lines = content.split('\n');
  return Array.from({ length: lines.length }, (_, i) => i + 1);
}

/**
 * Fetch a random joke from the API
 */
async function fetchRandomJoke(): Promise<string> {
  try {
    const response = await fetch('https://icanhazdadjoke.com/', {
      headers: {
        Accept: 'application/json',
      },
    });
    const data = await response.json();
    return data.joke;
  } catch (error) {
    return "I'm sorry, I couldn't find a joke for you :(";
  }
}

/**
 * Fetch paste content from API (Pull)
 * Returns paste data with encryption metadata
 */
async function fetchPaste(id: string): Promise<{ paste: string; isPasswordEncrypted: boolean; name?: string | null }> {
  console.log('Fetching paste with ID:', id);
  const response = await fetch(`${API_BASE}/get-paste?id=${id}`);
  console.log('Fetch response status:', response.status, response.ok);
  if (!response.ok) {
    // Check if paste was not found (might be burned or deleted)
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.response?.message || 'Failed to fetch paste';
    console.error('Fetch error:', errorMessage, errorData);
    throw new Error(errorMessage);
  }
  const data = await response.json();
  console.log('Fetch response data:', { hasResponse: !!data.response, hasPaste: !!data.response?.paste });
  const pasteData = data.response;
  if (pasteData && pasteData.paste) {
    return {
      paste: pasteData.paste,
      isPasswordEncrypted: pasteData.is_password_encrypted || false,
      name: pasteData.name || null,
    };
  }
  console.error('Paste data missing or invalid:', pasteData);
  throw new Error('Paste not found or invalid response');
}

/**
 * Store paste content to API (Push)
 * @param pasteContent - The paste content to store
 * @param recipientGhUsername - GitHub username of the recipient
 * @param name - Optional paste name
 * @param userId - Optional user ID
 * @param password - Optional password for password-protected paste
 * @param accessToken - Optional Supabase access token for authentication
 */
async function storePaste(
  pasteContent: string,
  recipientGhUsername: string = 'unknown',
  name: string | null = null,
  userId: string | null = null,
  password: string | null = null,
  accessToken: string | null = null,
  tags: string | null = null
): Promise<{ id: string; message: string }> {
  const body: any = {
    paste: pasteContent,
    recipient_gh_username: recipientGhUsername,
  };

  // Add optional fields if provided
  if (name && name.trim()) {
    body.name = name.trim();
  }
  if (userId) {
    body.user_id = userId;
  }
  // Include password if provided - server will verify authentication
  // Don't require userId on frontend since server validates auth anyway
  if (password) {
    body.password = password;
  }
  // Include tags if provided
  if (tags && tags.trim()) {
    body.tags = tags.trim();
  }

  const response = await fetchWithCsrf(
    `${API_BASE}/store-paste`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    accessToken
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.response?.message || 'Failed to store paste');
  }

  const data = await response.json();
  const pasteData = data.response;
  
  if (pasteData.id) {
    return {
      id: pasteData.id,
      message: pasteData.message || 'Paste stored successfully',
    };
  }
  
  throw new Error('Invalid response from server');
}

/**
 * PasteViewer component with modern UI/UX
 * Follows Laws of UX:
 * - Miller's Law: Limited options in UI
 * - Fitts's Law: Large, easy-to-click targets
 * - Hick's Law: Simple decision making
 * - Progressive Disclosure: Show/hide advanced features
 */
export default function PasteViewer() {
  const { user, session } = useAuth();
  const { resolvedTheme } = useTheme();
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [showGetPaste, setShowGetPaste] = useState(false);
  const [pasteIdInput, setPasteIdInput] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [pushedPasteId, setPushedPasteId] = useState<string | null>(null);
  const [pushedPasteName, setPushedPasteName] = useState<string | null>(null);
  const [isPasteCreated, setIsPasteCreated] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [instructionsCopied, setInstructionsCopied] = useState(false);
  const [showEncryptDialog, setShowEncryptDialog] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState<string>('');
  const [useRandomPassword, setUseRandomPassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [usedPassword, setUsedPassword] = useState<string | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState<string>('');
  const [pendingPasteData, setPendingPasteData] = useState<{ paste: string; id: string } | null>(null);
  const [showDecryptPassword, setShowDecryptPassword] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageValue>('text');
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isManualLanguageSelection, setIsManualLanguageSelection] = useState(false);
  const [pasteName, setPasteName] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [tagPills, setTagPills] = useState<string[]>([]);
  const [prismLoaded, setPrismLoaded] = useState(false);
  const [textWrap, setTextWrap] = useState(true);
  const [showSecretWarning, setShowSecretWarning] = useState(false);
  const [detectedSecrets, setDetectedSecrets] = useState<DetectedSecret[]>([]);
  const [pendingPushAction, setPendingPushAction] = useState<{ isEncrypted: boolean; password: string | null } | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [pendingPushAfterAuth, setPendingPushAfterAuth] = useState<{ isEncrypted: boolean; password: string | null } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pushButtonRef = useRef<HTMLDivElement>(null);
  const fetchingPasteIdRef = useRef<string | null>(null); // Track in-flight fetch to prevent duplicates

  /**
   * Load Prism.js and its components dynamically on client side
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadPrism = async () => {
      try {
        // Import Prism core as namespace to ensure it's fully initialized
        const PrismModule = await import('prismjs');
        const Prism = PrismModule.default || PrismModule;
        
        // Prism core should already have languages, util, and plugins initialized
        // We just need to ensure it's available globally for components
        
        // Make Prism available globally for components to register
        // Components need Prism to be on window.Prism to register themselves
        // Set both window.Prism and global Prism reference
        (window as any).Prism = Prism;
        
        // Ensure global self/window reference is available for components
        if (typeof globalThis !== 'undefined') {
          (globalThis as any).Prism = Prism;
        }
        
        // Load Prism components in dependency order
        // Base languages first (no dependencies) - must use static string literals
        await import('prismjs/components/prism-markup');
        await import('prismjs/components/prism-css');
        await import('prismjs/components/prism-javascript');
        
        // Languages that depend on markup
        await import('prismjs/components/prism-xml-doc');
        
        // Languages that depend on javascript
        await import('prismjs/components/prism-jsx');
        await import('prismjs/components/prism-typescript');
        await import('prismjs/components/prism-tsx');
        
        // Languages that depend on css
        await import('prismjs/components/prism-scss');
        
        // Independent languages
        await import('prismjs/components/prism-python');
        await import('prismjs/components/prism-java');
        await import('prismjs/components/prism-go');
        await import('prismjs/components/prism-rust');
        await import('prismjs/components/prism-php');
        await import('prismjs/components/prism-ruby');
        await import('prismjs/components/prism-swift');
        await import('prismjs/components/prism-kotlin');
        await import('prismjs/components/prism-scala');
        await import('prismjs/components/prism-json');
        await import('prismjs/components/prism-yaml');
        await import('prismjs/components/prism-markdown');
        await import('prismjs/components/prism-sql');
        await import('prismjs/components/prism-bash');
        await import('prismjs/components/prism-powershell');
        await import('prismjs/components/prism-docker');
        await import('prismjs/components/prism-ini');
        
        // Languages with dependencies - load c before cpp (cpp depends on c)
        await import('prismjs/components/prism-c');
        await import('prismjs/components/prism-cpp');
        await import('prismjs/components/prism-csharp');

        // Store Prism reference for highlightCode
        // Also ensure it's on window.Prism (components register there)
        (window as any).Prism = Prism;
        (window as any).__prism = Prism;
        setPrismLoaded(true);
      } catch (error) {
        console.error('Failed to load Prism.js:', error);
      }
    };

    loadPrism();
  }, []);

  /**
   * Apply secret highlighting to HTML code
   * Wraps detected secrets with a red background span
   * @param htmlCode - The HTML code (from Prism highlighting)
   * @param originalCode - The original plain text code
   * @returns HTML with secret highlighting applied
   */
  const applySecretHighlighting = (htmlCode: string, originalCode: string): string => {
    const secrets = detectSecrets(originalCode);
    if (secrets.length === 0) {
      return htmlCode;
    }

    // Sort secrets by position in reverse order to maintain indices when replacing
    const sortedSecrets = [...secrets].sort((a, b) => b.startIndex - a.startIndex);
    let result = htmlCode;
    
    // For each secret, find and wrap it in the HTML
    for (const secret of sortedSecrets) {
      const secretText = originalCode.substring(secret.startIndex, secret.endIndex);
      
      // Escape special regex characters
      const escapedSecret = secretText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Simple pattern: match the secret text, but not if it's already wrapped or inside HTML tags
      // We'll use a function to check context
      const pattern = new RegExp(escapedSecret.replace(/\s+/g, '\\s+'), 'gi');
      
      // Replace the secret text with a wrapped version
      let lastIndex = 0;
      result = result.replace(pattern, (match) => {
        const offset = result.indexOf(match, lastIndex);
        lastIndex = offset + match.length;
        
        // Skip if already wrapped in a secret-highlight span
        const beforeMatch = result.substring(Math.max(0, offset - 50), offset);
        const afterMatch = result.substring(offset + match.length, Math.min(result.length, offset + match.length + 50));
        
        if (beforeMatch.includes('<span class="secret-highlight">') || 
            afterMatch.includes('</span>')) {
          // Check if this match is part of an already-wrapped secret
          const fullContext = result.substring(Math.max(0, offset - 100), Math.min(result.length, offset + match.length + 100));
          if (fullContext.includes(`<span class="secret-highlight">${match}</span>`)) {
            return match;
          }
        }
        
        // Check if we're inside an HTML tag
        const beforeContext = result.substring(0, offset);
        const lastOpenTag = beforeContext.lastIndexOf('<');
        const lastCloseTag = beforeContext.lastIndexOf('>');
        if (lastOpenTag > lastCloseTag) {
          // We're inside a tag, don't wrap
          return match;
        }
        
        return `<span class="secret-highlight">${match}</span>`;
      });
    }
    
    return result;
  };

  /**
   * Highlight code using Prism (only works after Prism is loaded)
   */
  const highlightCode = (code: string, language: LanguageValue): string => {
    if (!prismLoaded || typeof window === 'undefined') {
      return code; // Return plain text if Prism not loaded
    }

    try {
      // Use window.Prism directly - this is where components register themselves
      const Prism = (window as any).Prism || (window as any).__prism;
      if (!Prism || typeof Prism.highlight !== 'function' || !Prism.languages) {
        return code;
      }

      const prismLang = getPrismLanguage(language);
      
      // Validate that the language grammar exists and is a valid object
      const lang = Prism.languages[prismLang];
      if (!lang || typeof lang !== 'object') {
        // Try plaintext as fallback
        const plaintextLang = Prism.languages.plaintext;
        if (plaintextLang && typeof plaintextLang === 'object') {
          const highlighted = Prism.highlight(code, plaintextLang, 'plaintext');
          return applySecretHighlighting(highlighted, code);
        }
        // If even plaintext doesn't work, return unhighlighted code
        return code;
      }

      // Double-check that Prism is fully initialized before highlighting
      if (!Prism.util || typeof Prism.highlight !== 'function') {
        return code;
      }

      // Validate that the language grammar is properly structured
      // Some languages might not be fully loaded or have invalid structures
      if (!lang || typeof lang !== 'object' || Array.isArray(lang)) {
        // Language grammar is invalid, try plaintext
        const plaintextLang = Prism.languages.plaintext;
        if (plaintextLang && typeof plaintextLang === 'object' && !Array.isArray(plaintextLang)) {
          const highlighted = Prism.highlight(code, plaintextLang, 'plaintext');
          return applySecretHighlighting(highlighted, code);
        }
        return code;
      }

      // Use a wrapper to catch any internal Prism errors
      try {
        const highlighted = Prism.highlight(code, lang, prismLang);
        return applySecretHighlighting(highlighted, code);
      } catch (highlightError: any) {
        // If highlighting fails, log and return unhighlighted code
        console.warn(`Prism highlighting failed for language ${prismLang}:`, highlightError);
        // Try to fallback to plaintext if available
        const plaintextLang = Prism.languages.plaintext;
        if (plaintextLang && typeof plaintextLang === 'object' && !Array.isArray(plaintextLang)) {
          try {
            const highlighted = Prism.highlight(code, plaintextLang, 'plaintext');
            return applySecretHighlighting(highlighted, code);
          } catch {
            // If even plaintext fails, return unhighlighted
            return code;
          }
        }
        return code;
      }
    } catch (error) {
      console.error('Error highlighting code:', error);
      // Return unhighlighted code on any error
      return code;
    }
  };

  useEffect(() => {
    setIsClient(true);
    // Check for ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    console.log('useEffect - URL ID:', id, 'Current fetching ID:', fetchingPasteIdRef.current);

    if (id && isValidPasteId(id)) {
      // Only fetch if not already fetching this ID (prevents duplicate fetches in React Strict Mode)
      if (fetchingPasteIdRef.current !== id) {
        console.log('Starting fetch for paste ID:', id);
        // Set ref immediately to prevent duplicate fetches
        fetchingPasteIdRef.current = id;
        handlePullPaste(id);
        // When viewing an existing paste, start in view mode
        setIsEditMode(false);
      } else {
        console.log('Skipping fetch - already fetching this ID');
      }
    } else {
      // Show intro paragraph and start in edit mode for new pastes
      setText(introParagraph);
      setIsEditMode(true);
      fetchRandomJoke().then((joke) => {
        setText(introParagraph + '\n\n' + joke);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Auto-detect language when text or filename changes
   * Only auto-detect if user hasn't manually selected a language
   */
  useEffect(() => {
    if (!isManualLanguageSelection) {
      if (text) {
        const detected = autoDetectLanguage(text, uploadedFileName || undefined);
        setSelectedLanguage(detected);
      } else {
        setSelectedLanguage('text');
      }
    }
  }, [text, uploadedFileName, isManualLanguageSelection]);

  /**
   * Handle paste event for CodeMirror editor
   * This handles paste events on the editor's textarea element
   */
  const handleEditorPaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get clipboard data
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData) {
      return;
    }

    // Try to get plain text first (preferred)
    let pastedText = clipboardData.getData('text/plain');
    
    // If no plain text, try to get HTML and extract text from it
    if (!pastedText) {
      const htmlData = clipboardData.getData('text/html');
      if (htmlData) {
        pastedText = htmlData;
      } else {
        // Fallback: try text format
        pastedText = clipboardData.getData('text') || '';
      }
    }

    // Sanitize the pasted text
    const sanitizedText = sanitizePastedText(pastedText);

    // Get the textarea element
    const textarea = e.target as HTMLTextAreaElement;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Use a function to get current text state
    setText((currentText) => {
      // Insert sanitized text at cursor position
      const newText = currentText.substring(0, start) + sanitizedText + currentText.substring(end);
      
      // Set cursor position after the inserted text
      setTimeout(() => {
        const newCursorPos = start + sanitizedText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
      
      return newText;
    });
  }, []);

  /**
   * Attach paste handler to CodeMirror editor textarea
   */
  useEffect(() => {
    if (!isClient || !isEditMode) {
      return;
    }

    const attachPasteHandler = () => {
      const editorContainer = editorContainerRef.current;
      if (editorContainer) {
        const textarea = editorContainer.querySelector('textarea') as HTMLTextAreaElement;
        if (textarea && !textarea.hasAttribute('data-paste-handler-attached')) {
          // Mark as attached to avoid duplicate handlers
          textarea.setAttribute('data-paste-handler-attached', 'true');
          // Add paste handler
          textarea.addEventListener('paste', handleEditorPaste);
        }
      }
    };

    // Attach handler after a short delay to ensure editor is rendered
    const timeoutId = setTimeout(attachPasteHandler, 100);

    // Use MutationObserver to detect when editor textarea is added/removed
    const observer = new MutationObserver(() => {
      attachPasteHandler();
    });

    const editorContainer = editorContainerRef.current;
    if (editorContainer) {
      observer.observe(editorContainer, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      // Cleanup: remove handler - capture ref value at cleanup time
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const editorContainerForCleanup = editorContainerRef.current;
      if (editorContainerForCleanup) {
        const textarea = editorContainerForCleanup.querySelector('textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.removeAttribute('data-paste-handler-attached');
          textarea.removeEventListener('paste', handleEditorPaste);
        }
      }
    };
  }, [isClient, isEditMode, handleEditorPaste]);

  /**
   * Auto-focus editor when entering edit mode
   */
  useEffect(() => {
    if (isEditMode && isClient && !isLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        // Find the textarea within the Editor component
        const editorContainer = editorContainerRef.current;
        if (editorContainer) {
          const textarea = editorContainer.querySelector('textarea') as HTMLTextAreaElement;
          if (textarea) {
            textarea.readOnly = isLoading;
            textarea.focus();
            // Move cursor to end of text
            const length = textarea.value.length;
            textarea.setSelectionRange(length, length);
          }
        }
      }, 100);
    }
  }, [isEditMode, isClient, isLoading]);

  /**
   * Update document title when paste is loaded
   * Use paste name if available, otherwise use website name
   */
  useEffect(() => {
    if (!isClient) return;

    if (pushedPasteId && pushedPasteName) {
      // Paste has a name: "{name} - PastePortal"
      document.title = `${pushedPasteName} - PastePortal`;
    } else if (pushedPasteId) {
      // Paste loaded but no name: use website name
      document.title = 'PastePortal - Share Code with Syntax Highlighting';
    } else {
      // No paste loaded: use default title
      document.title = 'PastePortal - Share Code with Syntax Highlighting';
    }
  }, [pushedPasteId, pushedPasteName, isClient]);

  /**
   * Handle push after authentication
   * When user becomes authenticated and there's a pending push action, execute it
   */
  useEffect(() => {
    if (user && pendingPushAfterAuth && !showAuthDialog) {
      // User just authenticated and auth dialog is closed
      const action = pendingPushAfterAuth;
      // Clear pending action first to prevent re-triggering
      setPendingPushAfterAuth(null);
      
      // Execute the pending push action
      if (action.isEncrypted) {
        // Show encryption dialog
        setShowEncryptDialog(true);
      } else {
        // Push directly without encryption
        handlePushPaste(false, null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingPushAfterAuth, showAuthDialog]);

  /**
   * Validate UUID v4 or legacy 6-character hex format
   */
  const isValidPasteId = (id: string): boolean => {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const legacyRegex = /^[a-fA-F0-9]{6}$/;
    return uuidRegex.test(id) || legacyRegex.test(id);
  };

  /**
   * Decrypt paste with password
   */
  const handleDecryptPaste = async () => {
    if (!decryptPassword || !pendingPasteData) {
      alert('Please enter the password to decrypt the paste.');
      return;
    }

      try {
        const decryptedText = await decryptWithPassword(decryptPassword, pendingPasteData.paste);
        setText(decryptedText);
        setIsManualLanguageSelection(false); // Allow auto-detection for new content
        setIsEditMode(false); // Start in view mode when loading existing paste
        setShowPasswordPrompt(false);
        setDecryptPassword('');
        setPendingPasteData(null);
      
      // Copy to clipboard
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(decryptedText);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to decrypt paste. Please check your password and try again.');
      setDecryptPassword('');
    }
  };

  /**
   * Pull paste from API by ID
   */
  const handlePullPaste = async (id: string) => {
    if (!id || !isValidPasteId(id)) {
      return;
    }

    // Prevent duplicate fetches for the same paste ID
    if (fetchingPasteIdRef.current === id) {
      return; // Already fetching this paste
    }

    fetchingPasteIdRef.current = id;
    setIsLoading(true);
    setPushedPasteId(null); // Clear previous push success
    setIsPasteCreated(false); // Clear paste created flag when loading
    setText(getRandomLoadingJoke());

    try {
      const result = await fetchPaste(id);
      
      console.log('Fetched paste result:', { 
        hasPaste: !!result.paste, 
        pasteLength: result.paste?.length,
        isPasswordEncrypted: result.isPasswordEncrypted 
      });
      
      // Store paste ID and name for document title (but don't mark as created)
      setPushedPasteId(id);
      setPushedPasteName(result.name || null);
      setIsPasteCreated(false); // This is a loaded paste, not a created one
      
      // Check if paste content is empty
      if (!result.paste || result.paste.trim().length === 0) {
        setText('⚠️ This paste appears to be empty or could not be retrieved.');
        setIsLoading(false);
        return;
      }
      
      // Check if paste is password-encrypted
      if (result.isPasswordEncrypted) {
        // Store paste data and show password prompt
        setPendingPasteData({ paste: result.paste, id });
        setShowPasswordPrompt(true);
        setIsLoading(false);
        return;
      }
      
      // Not encrypted, display directly
      setText(result.paste);
      setIsManualLanguageSelection(false); // Allow auto-detection for new content
      setIsEditMode(false); // Start in view mode when loading existing paste
      
      // Update URL with paste ID
      const url = new URL(window.location.href);
      url.searchParams.set('id', id);
      window.history.pushState({}, '', url);
      
      // Copy to clipboard
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(result.paste);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
        }
      }
    } catch (error: any) {
      console.error('Error in handlePullPaste:', error);
      // Check if paste was not found
      if (error.message?.includes('Failed to fetch paste') || error.message?.includes('not found') || error.message?.includes('no longer available')) {
        setText('⚠️ This paste is no longer available.\n\nIt may have been deleted.');
      } else {
        setText(`Error: Failed to retrieve paste. ${error.message || 'Please check the ID and try again.'}`);
      }
      setIsLoading(false);
      setIsEditMode(false);
    } finally {
      setIsLoading(false);
      fetchingPasteIdRef.current = null; // Clear fetching flag
    }
  };

  /**
   * Handle push button click - check authentication first, then show encryption dialog or push directly
   */
  const handlePushButtonClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if user is authenticated
    if (!user) {
      // Store the push action to execute after authentication
      const isEncryptClick = target.closest('.push-dropdown-arrow');
      setPendingPushAfterAuth({ 
        isEncrypted: isEncryptClick ? true : false, 
        password: null 
      });
      setShowAuthDialog(true);
      return;
    }
    
    // Check if dropdown arrow was clicked
    if (target.closest('.push-dropdown-arrow')) {
      setShowEncryptDialog(true);
      return;
    }
    // Otherwise, push directly without encryption
    handlePushPaste(false, null);
  };

  /**
   * Push/store paste to API
   * @param isEncrypted - Whether the paste should be encrypted
   * @param password - Password for encryption (if isEncrypted is true)
   */
  /**
   * Internal function to actually push the paste (after secret checks)
   * @param contentToPush - The content to push
   * @param isEncrypted - Whether the paste should be encrypted
   * @param password - Password for encryption (if isEncrypted is true)
   * @param secretsWereRedacted - Whether secrets were redacted from this paste
   * @param originalSecrets - Optional array of secrets detected in original text (before redaction)
   */
  const doPushPaste = async (contentToPush: string, isEncrypted: boolean = false, password: string | null = null, secretsWereRedacted: boolean = false, originalSecrets?: DetectedSecret[]) => {
    setIsPushing(true);
    setPushedPasteId(null);
    setUsedPassword(null);
    setShowEncryptDialog(false);

    try {
      let contentToStore = contentToPush;

      // Encrypt content if requested
      if (isEncrypted && password) {
        try {
          contentToStore = await encryptWithPassword(password, contentToPush);
          setUsedPassword(password);
        } catch (error: any) {
          alert(error.message || 'Failed to encrypt paste. Please try again.');
          setIsPushing(false);
          return;
        }
      }

      // Get user info if available
      const recipientGhUsername = 'unknown';
      const userId = user?.id || null;

      const nameToStore = pasteName.trim() || null;
      
      // Add security tags if secrets were redacted
      let tagsToStore = tagPills.length > 0 ? tagPills.join(',') : null;
      if (secretsWereRedacted && originalSecrets) {
        // Use the original secrets to determine which tags to add
        const secretTags = getSecretTags(originalSecrets);
        
        // Add contains-secrets tag
        const securityTag = 'contains-secrets';
        const tagsToAdd = [securityTag, ...secretTags];
        
        if (tagsToStore) {
          // Add tags that don't already exist
          const existingTags = tagsToStore.split(',').map(t => t.trim());
          const newTags = tagsToAdd.filter(tag => !existingTags.includes(tag));
          if (newTags.length > 0) {
            tagsToStore = `${tagsToStore},${newTags.join(',')}`;
          }
        } else {
          tagsToStore = tagsToAdd.join(',');
        }
      }
      // Pass access token to authenticate the request
      // This is needed because the client uses localStorage for sessions,
      // but the server expects cookies or Bearer tokens
      const accessToken = session?.access_token || null;
      const result = await storePaste(
        contentToStore,
        recipientGhUsername,
        nameToStore,
        userId,
        isEncrypted && password ? password : null,
        accessToken,
        tagsToStore
      );
      setPushedPasteId(result.id);
      setPushedPasteName(nameToStore);
      setIsPasteCreated(true); // Mark as created so share menu appears
      
      // Mark this paste as just pushed for portal animation
      sessionStorage.setItem('just-pushed-paste-id', result.id);
      
      // Clear paste name and tags after successful push
      setPasteName('');
      setTags('');
      setTagPills([]);

      // Update URL with new paste ID
      const url = new URL(window.location.href);
      url.searchParams.set('id', result.id);
      window.history.pushState({}, '', url);
      
      // Dispatch custom event to notify PortalAnimation of push
      window.dispatchEvent(new CustomEvent('paste-pushed', { detail: { id: result.id } }));

      // Success popup will be shown automatically via pushedPasteId state
    } catch (error: any) {
      console.error('Error pushing paste:', error);
      alert(error.message || 'Failed to push paste. Please try again.');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePushPaste = async (isEncrypted: boolean = false, password: string | null = null) => {
    if (!text || text.trim().length === 0) {
      alert('Please enter some content before pushing a paste.');
      return;
    }

    // Check size (400KB limit)
    const pasteSize = new Blob([text]).size;
    if (pasteSize > 400 * 1024) {
      alert('Paste size exceeds 400KB limit. Please reduce the content size.');
      return;
    }

    // Check for secrets before pushing
    const secrets = detectSecrets(text);
    if (secrets.length > 0) {
      // Store the push action parameters for later
      setPendingPushAction({ isEncrypted, password });
      setDetectedSecrets(secrets);
      setShowSecretWarning(true);
      return;
    }

    // No secrets detected, proceed with push
    await doPushPaste(text, isEncrypted, password, false);
  };

  /**
   * Handle user choosing to proceed with redaction
   */
  const handleProceedWithRedaction = async () => {
    if (!pendingPushAction) return;
    
    // Get secrets before redaction to determine tags
    const secrets = detectSecrets(text);
    const { redactedText } = redactSecrets(text);
    setText(redactedText); // Update the text with redacted version
    await doPushPaste(redactedText, pendingPushAction.isEncrypted, pendingPushAction.password, true, secrets);
    setPendingPushAction(null);
  };

  /**
   * Handle user choosing to cancel and edit manually
   */
  const handleCancelSecretWarning = () => {
    setPendingPushAction(null);
    setDetectedSecrets([]);
    // Focus the editor so user can edit
    if (editorContainerRef.current) {
      const textarea = editorContainerRef.current.querySelector('textarea');
      if (textarea) {
        textarea.focus();
      }
    }
  };

  /**
   * Handle paste event to sanitize pasted content
   * Extracts plain text from HTML/rich text clipboard content
   * @param e - Paste event
   */
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    
    // Get clipboard data
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData) {
      return;
    }

    // Try to get plain text first (preferred)
    let pastedText = clipboardData.getData('text/plain');
    
    // If no plain text, try to get HTML and extract text from it
    if (!pastedText) {
      const htmlData = clipboardData.getData('text/html');
      if (htmlData) {
        pastedText = htmlData;
      } else {
        // Fallback: try text format
        pastedText = clipboardData.getData('text') || '';
      }
    }

    // Sanitize the pasted text
    const sanitizedText = sanitizePastedText(pastedText);

    // Get the textarea element
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = text;

    // Insert sanitized text at cursor position
    const newText = currentText.substring(0, start) + sanitizedText + currentText.substring(end);
    setText(newText);

    // Set cursor position after the inserted text
    setTimeout(() => {
      const newCursorPos = start + sanitizedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  /**
   * Handle encryption dialog confirmation
   */
  const handleEncryptConfirm = () => {
    if (useRandomPassword) {
      const randomPwd = generateRandomPassword(16);
      handlePushPaste(true, randomPwd);
    } else {
      if (!encryptionPassword || encryptionPassword.trim().length === 0) {
        alert('Please enter a password or select "Use Random Password".');
        return;
      }
      try {
        // Validate password (will throw if invalid)
        if (encryptionPassword.length < 8 || encryptionPassword.length > 30) {
          throw new Error('Password must be between 8 and 30 characters.');
        }
        if (/[\s\t\n\r\v\f\0]/.test(encryptionPassword)) {
          throw new Error('Password should not contain whitespace characters.');
        }
        handlePushPaste(true, encryptionPassword);
      } catch (error: any) {
        alert(error.message || 'Invalid password. Please try again.');
      }
    }
  };

  const handlePasteIdSubmit = () => {
    if (isValidPasteId(pasteIdInput)) {
      handlePullPaste(pasteIdInput);
      setPasteIdInput('');
      setShowGetPaste(false);
    }
  };

  /**
   * Copy share link to clipboard
   */
  const handleCopyLink = async () => {
    if (!pushedPasteId) return;

    const shareUrl = `${window.location.origin}?id=${pushedPasteId}`;
    
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy link:', err);
        alert('Failed to copy link. Please copy it manually.');
      }
    }
  };

  /**
   * Copy formatted instructions to clipboard
   */
  const handleCopyInstructions = async () => {
    if (!pushedPasteId || typeof window === 'undefined') return;

    const shareUrl = `${window.location.origin}?id=${pushedPasteId}`;
    let instructions: string;

    const titleText = pushedPasteName ? ` "${pushedPasteName}"` : '';
    if (usedPassword) {
      instructions = `Check out this encrypted paste${titleText}!\n\nLink: ${shareUrl}\n\nPassword: ${usedPassword}`;
    } else {
      instructions = `Check out this paste${titleText}:\n\nLink: ${shareUrl}`;
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(instructions);
        setInstructionsCopied(true);
        setTimeout(() => setInstructionsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy instructions:', err);
        alert('Failed to copy instructions. Please copy them manually.');
      }
    }
  };

  /**
   * Get share URL
   */
  const getShareUrl = (): string => {
    if (!pushedPasteId || typeof window === 'undefined') return '';
    return `${window.location.origin}?id=${pushedPasteId}`;
  };

  /**
   * Get share text for social platforms
   */
  const getShareText = (): string => {
    const titleText = pushedPasteName ? ` "${pushedPasteName}"` : '';
    if (usedPassword) {
      return `Check out this encrypted paste${titleText}!\n\nLink: ${getShareUrl()}\nPassword: ${usedPassword}`;
    }
    return `Check out this paste${titleText}: ${getShareUrl()}`;
  };

  /**
   * Share to WhatsApp
   */
  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(getShareText())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Share to Facebook
   */
  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Share to Twitter/X
   */
  const handleShareTwitter = () => {
    const titleText = pushedPasteName ? ` "${pushedPasteName}"` : '';
    const text = usedPassword 
      ? `Check out this encrypted paste${titleText}! Link: ${getShareUrl()} Password: ${usedPassword}`
      : `Check out this paste${titleText}: ${getShareUrl()}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Share to LinkedIn
   */
  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Share to Telegram
   */
  const handleShareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(getShareText())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Share via Email
   */
  const handleShareEmail = () => {
    const subject = pushedPasteName ? pushedPasteName : 'Check out this paste';
    const body = getShareText();
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const handleCopy = async () => {
    if (text && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  /**
   * Handle file upload - read file content and populate textarea
   * Follows Fitts's Law: Large, easy-to-click file upload button
   */
  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  /**
   * Process selected file and read its content
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (400KB limit, matching API limit)
    if (file.size > 400 * 1024) {
      alert('File size exceeds 400KB limit. Please select a smaller file.');
      return;
    }

    try {
      const fileContent = await file.text();
      setText(fileContent);
      setUploadedFileName(file.name);
      setIsManualLanguageSelection(false); // Allow auto-detection for new content
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to read file:', error);
      alert('Failed to read file. Please try again.');
    }
  };

  /**
   * Download paste content as a file
   * Follows Miller's Law: Simple, clear download action
   */
  const handleDownload = () => {
    if (!text) return;

    try {
      // Create blob with text content
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Create temporary download link
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename from paste ID or use default
      const urlParams = new URLSearchParams(window.location.search);
      const pasteId = urlParams.get('id');
      // Truncate UUID for filename (use first 8 chars)
      const filename = pasteId 
        ? `paste-${pasteId.length > 8 ? pasteId.substring(0, 8) : pasteId}.txt` 
        : 'paste-content.txt';
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (error) {
      console.error('Failed to download:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-0">
      {/* Success Popup Modal for Push - Only show when paste was created */}
      {pushedPasteId && isPasteCreated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => {
          setPushedPasteId(null);
          setUsedPassword(null);
          setIsPasteCreated(false);
        }}>
          <div className="bg-surface border border-divider rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4 gap-3">
                <h3 className="text-base sm:text-lg font-semibold text-text flex items-center gap-2 flex-wrap">
                  <svg className="w-5 h-5 text-positive-highlight flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="flex-1 min-w-0">Paste Created Successfully!</span>
                  {usedPassword && (
                    <span className="text-xs bg-neon-magenta/20 text-neon-magenta px-2 py-0.5 sm:px-2.5 rounded whitespace-nowrap">
                      🔒 Encrypted
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setPushedPasteId(null);
                    setUsedPassword(null);
                    setIsPasteCreated(false);
                  }}
                  className="text-text-secondary hover:text-text transition-colors p-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close dialog"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Paste ID */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">
                    Paste ID
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <code className="flex-1 bg-background border border-divider px-3 py-2 rounded font-mono text-xs sm:text-sm text-text break-all min-w-0">
                      {pushedPasteId}
                    </code>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(pushedPasteId);
                          alert('Paste ID copied to clipboard!');
                        } catch (err) {
                          console.error('Failed to copy paste ID:', err);
                        }
                      }}
                      className="px-4 py-2.5 sm:px-3 sm:py-2 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm min-h-[44px] sm:min-h-0 flex items-center justify-center gap-2"
                      title="Copy paste ID"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="sm:hidden">Copy ID</span>
                    </button>
                  </div>
                </div>

                {/* Share URL */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">
                    Share URL
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <code className="flex-1 bg-background border border-divider px-3 py-2 rounded font-mono text-xs text-text break-all min-w-0">
                      {typeof window !== 'undefined' ? `${window.location.origin}?id=${pushedPasteId}` : ''}
                    </code>
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2.5 rounded-lg bg-positive-highlight text-black hover:opacity-90 transition-opacity text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap min-h-[44px]"
                    >
                      {linkCopied ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Password if encrypted */}
                {usedPassword && (
                  <div className="bg-neon-magenta/10 border border-neon-magenta/30 rounded-lg p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <svg className="w-5 h-5 text-neon-magenta mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text mb-1">🔒 Encryption Password</p>
                        <p className="text-xs text-text-secondary mb-3">
                          ⚠️ Save this password! You&apos;ll need it to decrypt the paste.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <code className="flex-1 bg-background border border-divider px-3 py-2 rounded font-mono text-xs sm:text-sm text-text break-all min-w-0">
                        {usedPassword}
                      </code>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(usedPassword);
                            alert('Password copied to clipboard!');
                          } catch (err) {
                            console.error('Failed to copy password:', err);
                          }
                        }}
                        className="px-4 py-2.5 sm:px-3 sm:py-2 rounded-lg bg-neon-magenta text-black hover:bg-neon-magenta-600 transition-colors text-sm min-h-[44px] sm:min-h-0 flex items-center justify-center gap-2"
                        title="Copy password"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="sm:hidden">Copy</span>
                      </button>
                    </div>
                  </div>
                )}


                {/* Share Options */}
                <div className="pt-4 border-t border-divider">
                  <label className="block text-xs font-medium text-text-secondary mb-3">
                    Share
                  </label>
                  
                  {/* Copy Instructions Button */}
                  <button
                    onClick={handleCopyInstructions}
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-neon-cyan text-black hover:bg-neon-cyan-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {instructionsCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Instructions Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Instructions
                      </>
                    )}
                  </button>

                  {/* Social Share Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* WhatsApp */}
                    <button
                      onClick={handleShareWhatsApp}
                      className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-3 rounded-lg bg-[#25D366] hover:bg-[#20BA5A] text-white transition-colors text-xs font-medium min-h-[64px]"
                      title="Share on WhatsApp"
                      aria-label="Share on WhatsApp"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <span className="text-[10px]">WhatsApp</span>
                    </button>

                    {/* Facebook */}
                    <button
                      onClick={handleShareFacebook}
                      className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-3 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white transition-colors text-xs font-medium min-h-[64px]"
                      title="Share on Facebook"
                      aria-label="Share on Facebook"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="text-[10px]">Facebook</span>
                    </button>

                    {/* Twitter/X */}
                    <button
                      onClick={handleShareTwitter}
                      className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-3 rounded-lg bg-[#000000] hover:bg-[#1a1a1a] text-white transition-colors text-xs font-medium min-h-[64px]"
                      title="Share on Twitter/X"
                      aria-label="Share on Twitter/X"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span className="text-[10px]">Twitter</span>
                    </button>

                    {/* LinkedIn */}
                    <button
                      onClick={handleShareLinkedIn}
                      className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-3 rounded-lg bg-[#0A66C2] hover:bg-[#095195] text-white transition-colors text-xs font-medium min-h-[64px]"
                      title="Share on LinkedIn"
                      aria-label="Share on LinkedIn"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <span className="text-[10px]">LinkedIn</span>
                    </button>

                    {/* Telegram */}
                    <button
                      onClick={handleShareTelegram}
                      className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-3 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white transition-colors text-xs font-medium min-h-[64px]"
                      title="Share on Telegram"
                      aria-label="Share on Telegram"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                      <span className="text-[10px]">Telegram</span>
                    </button>

                    {/* Email */}
                    <button
                      onClick={handleShareEmail}
                      className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-3 rounded-lg bg-surface-variant border border-divider hover:bg-surface text-text transition-colors text-xs font-medium min-h-[64px]"
                      title="Share via Email"
                      aria-label="Share via Email"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px]">Email</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setPushedPasteId(null);
                    setPushedPasteName(null);
                    setUsedPassword(null);
                    setIsPasteCreated(false);
                    setInstructionsCopied(false);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-neon-cyan text-black hover:bg-neon-cyan-600 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Prompt Dialog for Encrypted Pastes */}
      {showPasswordPrompt && pendingPasteData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => {
          setShowPasswordPrompt(false);
          setPendingPasteData(null);
          setDecryptPassword('');
        }}>
          <div className="bg-surface border border-divider rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4 gap-3">
                <h3 className="text-base sm:text-lg font-semibold text-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-neon-magenta flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Password Required</span>
                </h3>
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPendingPasteData(null);
                    setDecryptPassword('');
                  }}
                  className="text-text-secondary hover:text-text transition-colors p-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close dialog"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-text-secondary mb-4">
                This paste is encrypted with a password. Please enter the password to decrypt it.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="decrypt-password" className="block text-sm font-medium text-text mb-2">
                    Decryption Password
                  </label>
                  <div className="relative">
                    <input
                      type={showDecryptPassword ? 'text' : 'password'}
                      id="decrypt-password"
                      value={decryptPassword}
                      onChange={(e) => setDecryptPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-3 py-2.5 sm:py-2 bg-background border border-divider rounded-lg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-neon-magenta focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && decryptPassword) {
                          handleDecryptPaste();
                        }
                      }}
                      autoFocus
                    />
                    {decryptPassword && (
                      <button
                        type="button"
                        onClick={() => setShowDecryptPassword(!showDecryptPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label={showDecryptPassword ? 'Hide password' : 'Show password'}
                      >
                        {showDecryptPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPendingPasteData(null);
                    setDecryptPassword('');
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecryptPaste}
                  disabled={!decryptPassword}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-neon-magenta text-black hover:bg-neon-magenta-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
                >
                  Decrypt & View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Encryption Dialog Modal */}
      {showEncryptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowEncryptDialog(false)}>
          <div className="bg-surface border border-divider rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4 gap-3">
                <h3 className="text-base sm:text-lg font-semibold text-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-neon-magenta flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Encrypt Paste</span>
                </h3>
                <button
                  onClick={() => setShowEncryptDialog(false)}
                  className="text-text-secondary hover:text-text transition-colors p-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close dialog"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Option: Use Random Password */}
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="random-password"
                    checked={useRandomPassword}
                    onChange={() => {
                      setUseRandomPassword(true);
                      setEncryptionPassword('');
                    }}
                    className="w-4 h-4 text-neon-magenta focus:ring-neon-magenta"
                  />
                  <label htmlFor="random-password" className="flex-1 text-text cursor-pointer">
                    <div className="font-medium">Use Random Password</div>
                    <div className="text-xs text-text-secondary">A secure password will be generated automatically</div>
                  </label>
                </div>

                {/* Option: Custom Password */}
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="custom-password"
                    checked={!useRandomPassword}
                    onChange={() => setUseRandomPassword(false)}
                    className="w-4 h-4 mt-1 text-neon-magenta focus:ring-neon-magenta"
                  />
                  <label htmlFor="custom-password" className="flex-1 text-text cursor-pointer">
                    <div className="font-medium mb-2">Use Custom Password</div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={encryptionPassword}
                        onChange={(e) => setEncryptionPassword(e.target.value)}
                        placeholder="Enter password (8-30 characters, no spaces)"
                        className="w-full px-3 py-2.5 sm:py-2 bg-background border border-divider rounded-lg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-neon-magenta focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                        disabled={useRandomPassword}
                      />
                      {!useRandomPassword && encryptionPassword && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      Must be 8-30 characters, no spaces or special whitespace
                    </div>
                  </label>
                </div>

              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => setShowEncryptDialog(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowEncryptDialog(false);
                    handlePushPaste(false, null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
                >
                  Push Without Encryption
                </button>
                <button
                  onClick={handleEncryptConfirm}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-neon-magenta text-white hover:bg-neon-magenta-600 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
                >
                  Push Encrypted
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secret Warning Dialog */}
      <SecretWarningDialog
        isOpen={showSecretWarning}
        onClose={() => {
          setShowSecretWarning(false);
          setPendingPushAction(null);
        }}
        secrets={detectedSecrets}
        onProceedWithRedaction={handleProceedWithRedaction}
        onCancel={handleCancelSecretWarning}
      />

      {/* Auth Dialog - Show when user tries to push without being authenticated */}
      <AuthDialog
        isOpen={showAuthDialog}
        onClose={() => {
          setShowAuthDialog(false);
          // Clear pending push action if user closes dialog without authenticating
          if (!user) {
            setPendingPushAfterAuth(null);
          }
        }}
        initialMode="signin"
        customTitle="🚀 Unlock the Full Power of PastePortal!"
        customDescription="Sign in now to push your paste and unlock amazing features! ✨\n\n• 📝 Name your pastes for easy identification\n• 🏷️ Add tags to organize and find pastes quickly\n• 🔒 Encrypt sensitive content with password protection\n• 📚 Access your complete paste history\n• ⚡ Faster workflow with saved preferences\n\nJoin thousands of developers sharing code snippets with style!"
      />

      {/* Toolbar Section - Redesigned with proper spacing and organization */}
      {/* Law of Proximity: Related items grouped together */}
      {/* Law of Common Region: Visual grouping with clear boundaries */}
      {/* Law of Alignment: Consistent alignment throughout */}
      {/* Law of Symmetry: Balanced layout */}
      <div className="border-b border-divider/50 w-full">
        <div className="mx-auto px-3 sm:px-4 lg:px-6 py-3 max-w-7xl">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="text/*,.txt,.json,.js,.ts,.jsx,.tsx,.css,.html,.md,.py,.java,.cpp,.c,.go,.rs,.php,.rb,.swift,.kt,.scala,.sh,.yaml,.yml,.xml,.sql"
            onChange={handleFileChange}
            className="hidden"
            aria-label="File upload input"
          />

          {/* Main Toolbar Row */}
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            {/* GROUP 1: Pull Section */}
            <div className="flex gap-2 items-center w-full lg:w-auto lg:min-w-[240px]">
              <div className="relative flex-1 lg:flex-initial lg:min-w-[180px]">
                <label htmlFor="paste-id-input" className="sr-only">Enter paste ID</label>
                <input
                  id="paste-id-input"
                  data-tour="paste-id-input"
                  type="text"
                  value={pasteIdInput}
                  onChange={(e) => setPasteIdInput(e.target.value)}
                  placeholder="Enter paste ID"
                  className="w-full px-3 py-2 bg-surface border border-divider/60 rounded-lg text-text placeholder:text-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan transition-all duration-200 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidPasteId(pasteIdInput)) {
                      handlePasteIdSubmit();
                    }
                  }}
                />
                {pasteIdInput.length > 0 && (
                  <button
                    onClick={() => setPasteIdInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary/60 hover:text-text transition-colors p-1"
                    aria-label="Clear input"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                data-tour="pull-button"
                onClick={handlePasteIdSubmit}
                disabled={!isValidPasteId(pasteIdInput) || isLoading}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
                  isValidPasteId(pasteIdInput) && !isLoading
                    ? 'bg-neon-cyan text-black hover:opacity-90 active:scale-[0.98]'
                    : 'bg-surface-variant/50 text-text-secondary/70 border border-divider/60'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Pulling
                  </span>
                ) : (
                  'Pull'
                )}
              </button>
            </div>

            {/* Visual Separator */}
            <div className="hidden lg:block w-px h-8 bg-divider/30"></div>

            {/* GROUP 2: Push Section - Name, Tags (for authenticated users), Push (for everyone) */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1 lg:flex-initial lg:min-w-0 w-full lg:w-auto">
              {/* Name Input - Only for authenticated users */}
              {user && (
                <div className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[200px]">
                  <label htmlFor="paste-name-input" className="sr-only">Optional: Name your paste</label>
                  <input
                    id="paste-name-input"
                    data-tour="paste-name-input"
                    type="text"
                    value={pasteName}
                    onChange={(e) => setPasteName(e.target.value)}
                    placeholder="Name your paste"
                    className="w-full px-3 py-2 bg-surface border border-divider/60 rounded-lg text-text placeholder:text-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-neon-teal focus:border-neon-teal transition-all duration-200 text-sm"
                  />
                </div>
              )}

              {/* Tags Input - Only for authenticated users */}
              {user && (
                <div className="w-full sm:w-auto sm:min-w-[140px] sm:max-w-[180px]">
                  <label htmlFor="paste-tags-input" className="sr-only">Optional: Add tags</label>
                  <input
                    id="paste-tags-input"
                    type="text"
                    value={tags}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTags(value);
                      if (value.includes(',')) {
                        const newTagsFromInput = value
                          .split(',')
                          .map(tag => tag.trim())
                          .filter(tag => tag.length > 0);
                        const mergedTags = [...tagPills];
                        newTagsFromInput.forEach(tag => {
                          if (!mergedTags.includes(tag) && mergedTags.length < 20) {
                            mergedTags.push(tag);
                          }
                        });
                        setTagPills(mergedTags.slice(0, 20));
                        setTags('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tags.trim()) {
                        e.preventDefault();
                        const trimmedTag = tags.trim();
                        if (trimmedTag && !tagPills.includes(trimmedTag) && tagPills.length < 20) {
                          setTagPills([...tagPills, trimmedTag]);
                          setTags('');
                        }
                      } else if (e.key === 'Backspace' && tags === '' && tagPills.length > 0) {
                        setTagPills(tagPills.slice(0, -1));
                      }
                    }}
                    placeholder={tagPills.length > 0 ? `${tagPills.length} tag${tagPills.length > 1 ? 's' : ''}` : "Tags"}
                    className="w-full px-3 py-2 bg-surface border border-divider/60 rounded-lg text-text placeholder:text-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-neon-teal focus:border-neon-teal transition-all duration-200 text-sm"
                  />
                </div>
              )}

              {/* Push Button - Available to everyone */}
              <div ref={pushButtonRef} data-tour="push-button" className="relative flex shrink-0 w-full sm:w-auto">
                <button
                  onClick={handlePushButtonClick}
                  disabled={!text || text.trim().length === 0 || isPushing}
                  className={`w-full sm:w-auto px-4 py-2 rounded-l-lg font-medium text-sm transition-all duration-200 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    text && text.trim().length > 0 && !isPushing
                      ? 'bg-neon-magenta text-white hover:opacity-90 active:scale-[0.98]'
                      : 'bg-surface-variant/50 text-text-secondary/70 border border-divider/60'
                  }`}
                >
                  {isPushing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Pushing
                    </span>
                  ) : (
                    'Push'
                  )}
                </button>
                {text && text.trim().length > 0 && !isPushing && (
                  <button
                    data-tour="push-encrypt"
                    onClick={() => {
                      if (!user) {
                        setPendingPushAfterAuth({ isEncrypted: true, password: null });
                        setShowAuthDialog(true);
                      } else {
                        setShowEncryptDialog(true);
                      }
                    }}
                    className="px-2.5 py-2 rounded-r-lg border-l border-white/20 transition-all duration-200 bg-neon-magenta text-white hover:opacity-90 flex items-center justify-center"
                    aria-label="Encryption options"
                    title="Encryption options"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Visual Separator */}
            <div className="hidden lg:block w-px h-8 bg-divider/30"></div>

            {/* GROUP 3: Toolbox - Language, File Ops, View Options */}
            <div className="flex gap-2 items-center flex-wrap lg:flex-nowrap w-full lg:w-auto">
              {/* Language Selection */}
              {!isLoading && text && (
                <>
                  <div className="relative flex-1 sm:flex-initial sm:w-[110px] sm:min-w-[110px]">
                    <label htmlFor="language-select" className="sr-only">Select syntax highlighting language</label>
                    <select
                      id="language-select"
                      data-tour="language-selector"
                      value={selectedLanguage}
                      onChange={(e) => {
                        setSelectedLanguage(e.target.value as LanguageValue);
                        setIsManualLanguageSelection(true);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-surface-variant border border-divider/60 text-text hover:bg-surface transition-all duration-200 text-sm font-medium cursor-pointer appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan [&>option]:bg-surface [&>option]:text-text"
                      style={{
                        backgroundColor: 'var(--color-surface-variant)',
                        color: 'var(--color-text)',
                      }}
                      aria-label="Select syntax highlighting language"
                      title="Language"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option 
                          key={lang.value} 
                          value={lang.value}
                          style={{
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {lang.label}
                        </option>
                      ))}
                    </select>
                    <svg 
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary/60 pointer-events-none" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="hidden lg:block w-px h-6 bg-divider/30"></div>
                </>
              )}

              {/* File Operations */}
              <div className="flex gap-1 items-center">
                <button
                  data-tour="upload-button"
                  onClick={handleFileUpload}
                  className="px-2.5 py-2 rounded-lg bg-surface-variant/50 border border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant transition-all duration-200 active:scale-[0.98] flex items-center justify-center shrink-0"
                  aria-label="Upload file"
                  title="Upload file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </button>
                {text && (
                  <button
                    data-tour="download-button"
                    onClick={handleDownload}
                    className="px-2.5 py-2 rounded-lg bg-surface-variant/50 border border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant transition-all duration-200 active:scale-[0.98] flex items-center justify-center shrink-0"
                    aria-label={downloaded ? 'Downloaded!' : 'Download paste'}
                    title="Download"
                  >
                    {downloaded ? (
                      <svg className="w-4 h-4 text-positive-highlight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {/* Copy Button */}
              {text && (
                <>
                  <div className="hidden lg:block w-px h-6 bg-divider/30"></div>
                  <button
                    data-tour="copy-button"
                    onClick={handleCopy}
                    className="px-2.5 py-2 rounded-lg bg-surface-variant/50 border border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant transition-all duration-200 active:scale-[0.98] flex items-center justify-center shrink-0"
                    aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
                    title="Copy"
                  >
                    {copied ? (
                      <svg className="w-4 h-4 text-positive-highlight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </>
              )}

              {/* Text Wrap Toggle */}
              {text && (
                <>
                  <div className="hidden lg:block w-px h-6 bg-divider/30"></div>
                  <button
                    onClick={() => setTextWrap(!textWrap)}
                    className={`px-2.5 py-2 rounded-lg border transition-all duration-200 active:scale-[0.98] flex items-center justify-center shrink-0 ${
                      textWrap
                        ? 'bg-positive-highlight/20 border-positive-highlight/40 text-positive-highlight hover:bg-positive-highlight/30'
                        : 'bg-surface-variant/50 border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant'
                    }`}
                    aria-label={textWrap ? 'Disable text wrap' : 'Enable text wrap'}
                    title={textWrap ? 'Text wrap: ON' : 'Text wrap: OFF'}
                  >
                    {textWrap ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    )}
                  </button>
                </>
              )}

              {/* Edit/View Toggle */}
              {!isLoading && (
                <>
                  {text && <div className="hidden lg:block w-px h-6 bg-divider/30"></div>}
                  <button
                    data-tour="edit-view-toggle"
                    onClick={() => {
                      setIsEditMode(!isEditMode);
                      if (!isEditMode) {
                        setTimeout(() => {
                          const editorContainer = editorContainerRef.current;
                          if (editorContainer) {
                            const textarea = editorContainer.querySelector('textarea') as HTMLTextAreaElement;
                            textarea?.focus();
                          }
                        }, 100);
                      }
                    }}
                    className={`px-2.5 py-2 rounded-lg border transition-all duration-200 active:scale-[0.98] flex items-center justify-center shrink-0 ${
                      isEditMode
                        ? 'bg-positive-highlight/20 border-positive-highlight/40 text-positive-highlight hover:bg-positive-highlight/30'
                        : 'bg-surface-variant/50 border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant'
                    }`}
                    aria-label={isEditMode ? 'Switch to view mode' : 'Switch to edit mode'}
                    title={isEditMode ? 'View mode' : 'Edit mode'}
                  >
                    {isEditMode ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tags Display Row - Separate row below main toolbar to prevent overlap */}
          {user && tagPills.length > 0 && (
            <div className="w-full mt-3 pt-3 border-t border-divider/30 flex flex-wrap gap-1.5 items-center justify-center">
              {tagPills.map((tag, index) => {
                // Calculate order for center-outwards pattern:
                // Index 0: center (order 0)
                // Index 1: left (order -1)
                // Index 2: right (order 1)
                // Index 3: further left (order -2)
                // Index 4: further right (order 2)
                const order = index === 0 
                  ? 0 
                  : index % 2 === 1 
                    ? -(index + 1) / 2 
                    : index / 2;
                
                return (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-positive-highlight/20 text-positive-highlight border border-positive-highlight/40 rounded-md text-xs font-medium"
                    style={{ order }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagPills(tagPills.filter((_, i) => i !== index));
                      }}
                      className="hover:text-text focus:outline-none rounded transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative w-full overflow-x-hidden" data-tour="main-editor">
        {isEditMode ? (
          // Edit mode: syntax-highlighted code editor with line numbers
          <div className={`w-full h-full min-h-[60vh] overflow-auto ${textWrap ? 'overflow-x-hidden' : 'overflow-x-auto'}`}>
            <div className="flex min-w-0">
              {/* Line numbers gutter */}
              <div 
                className="flex-shrink-0 bg-surface-variant/30 border-r border-divider/40 px-2 sm:px-3 py-4 sm:py-6 lg:py-8 select-none text-text-secondary/60 text-right font-mono text-xs sm:text-sm md:text-base leading-[1.75rem]"
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  minWidth: '2.5rem',
                  maxWidth: '2.5rem',
                  userSelect: 'none',
                }}
              >
                {getLineNumbers(text).map((lineNum) => (
                  <div key={lineNum} className="h-[1.75rem]">
                    {lineNum}
                  </div>
                ))}
              </div>
              
              {/* Editor container */}
              <div ref={editorContainerRef} className={`flex-1 min-w-0 ${textWrap ? 'overflow-x-hidden' : 'overflow-x-auto'}`}>
                {isClient ? (
                  <Editor
                      value={text}
                      onValueChange={(code) => setText(code)}
                      highlight={(code) => highlightCode(code, selectedLanguage)}
                      padding={16}
                      className={`w-full h-full min-h-[60vh] font-mono text-sm sm:text-base ${textWrap ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
                      style={{
                        fontFamily: 'var(--font-mono), monospace',
                        fontSize: 'inherit',
                        lineHeight: '1.75rem',
                        outline: 'none',
                        background: 'var(--color-background)',
                        color: 'var(--color-text)',
                        minHeight: '60vh',
                        maxWidth: '100%',
                        overflowX: textWrap ? 'hidden' : 'auto',
                        whiteSpace: textWrap ? 'pre-wrap' : 'pre',
                        wordBreak: textWrap ? 'break-word' : 'normal',
                      }}
                      textareaClassName={`w-full h-full min-h-[60vh] font-mono text-sm sm:text-base resize-none outline-none leading-relaxed focus:outline-none focus:ring-0 border-0 cursor-text bg-transparent text-inherit caret-current ${textWrap ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
                      preClassName={`m-0 p-4 sm:p-6 lg:p-8 bg-transparent ${textWrap ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
                      placeholder="Start typing or paste your content here..."
                      disabled={isLoading}
                      tabSize={2}
                      insertSpaces={true}
                    />
                ) : (
                  // Fallback textarea while Editor loads (SSR/hydration)
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onPaste={handlePaste}
                    readOnly={isLoading}
                    className={`w-full h-full min-h-[60vh] bg-background text-text font-mono text-sm sm:text-base p-4 sm:p-6 lg:p-8 resize-none outline-none leading-relaxed focus:outline-none focus:ring-0 border-0 cursor-text ${textWrap ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
                    style={{ 
                      minHeight: '60vh', 
                      maxWidth: '100%',
                      whiteSpace: textWrap ? 'pre-wrap' : 'pre',
                      wordBreak: textWrap ? 'break-word' : 'normal',
                    }}
                    spellCheck={false}
                    placeholder="Start typing or paste your content here..."
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          // View mode: syntax highlighting
          <div className={`w-full h-full min-h-[60vh] overflow-auto ${textWrap ? 'overflow-x-hidden' : 'overflow-x-auto'}`}>
            {text ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: applySecretHighlighting(
                    highlightCode(text, selectedLanguage),
                    text
                  ),
                }}
                className="p-4 sm:p-6 lg:p-8"
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: '0.875rem',
                  lineHeight: '1.75rem',
                  background: 'var(--color-background)',
                  color: 'var(--color-text)',
                  whiteSpace: textWrap ? 'pre-wrap' : 'pre',
                  wordBreak: textWrap ? 'break-word' : 'normal',
                  overflowX: textWrap ? 'hidden' : 'auto',
                }}
              />
            ) : (
              <div className="p-4 sm:p-6 lg:p-8 text-text-secondary text-sm">
                No content to display
              </div>
            )}
          </div>
        )}
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center pointer-events-auto">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan mx-auto mb-4"></div>
              <p className="text-text-secondary text-sm">{text}</p>
            </div>
          </div>
        )}
      </div>

      {/* Empty State - only show when not in edit mode */}
      {!text && !isLoading && !isEditMode && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">No paste loaded</h2>
            <p className="text-text-secondary text-sm">
              Enter a paste ID above to view content, or wait for a paste to be shared with you.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}