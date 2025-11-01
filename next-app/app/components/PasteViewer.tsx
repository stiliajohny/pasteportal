'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { encryptWithPassword, decryptWithPassword, generateRandomPassword } from '@/lib/password-encryption';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { autoDetectLanguage, SUPPORTED_LANGUAGES, LanguageValue } from '@/lib/language-detection';
import { useTheme } from './ThemeProvider';

const API_BASE = '/api/v1';

const introParagraph = `Welcome to PastePortal!

Are you tired of copying your code from VS Code and losing all the syntax highlighting?
Now you can directly share from your VS Code and share the link, and the receiver will see the code with the syntax highlighting!

A two-step process to share your code:
1. Select your code
2. Press Ctrl+Alt+Cmd+P, and you get a link to share with your friends!

--

How to use it:

Download the VS Code Extension and use the Command palette, Sidebar or Shortcut

---

A brief overview of how PastePortal was created (shout out for the prompt @craigmillerdev):

Once upon a time, I was tasked with creating a technical challenge for a job candidate, one that would involve building a service for posting and retrieving messages using their preferred tech stack.
I wanted to see how the candidate would approach the problem and develop a solution. This led to the development of PastePortal.
In addition, you can enhance your experience by downloading the PastePortal VS Code extension, which allows you to access PastePortal directly from your code editor!

https://marketplace.visualstudio.com/items?itemName=JohnStilia.pasteportal

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
async function fetchPaste(id: string): Promise<{ paste: string; isPasswordEncrypted: boolean }> {
  const response = await fetch(`${API_BASE}/get-paste?id=${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch paste');
  }
  const data = await response.json();
  const pasteData = data.response;
  if (pasteData.paste) {
    return {
      paste: pasteData.paste,
      isPasswordEncrypted: pasteData.is_password_encrypted || false,
    };
  }
  throw new Error('Paste not found');
}

/**
 * Store paste content to API (Push)
 */
async function storePaste(
  pasteContent: string,
  recipientGhUsername: string = 'unknown',
  name: string | null = null,
  userId: string | null = null,
  password: string | null = null
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
  // Only include password if user is authenticated and paste is password-protected
  if (password && userId) {
    body.password = password;
  }

  const response = await fetch(`${API_BASE}/store-paste`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

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
  const { user } = useAuth();
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
  const [linkCopied, setLinkCopied] = useState(false);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pushButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    // Check for ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
      handlePullPaste(id);
      // When viewing an existing paste, start in view mode
      setIsEditMode(false);
    } else {
      // Show intro paragraph and start in edit mode for new pastes
      setText(introParagraph);
      setIsEditMode(true);
      fetchRandomJoke().then((joke) => {
        setText(introParagraph + '\n\n' + joke);
      });
    }
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
   * Auto-focus textarea when entering edit mode
   */
  useEffect(() => {
    if (isEditMode && textareaRef.current && isClient && !isLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.readOnly = isLoading;
          textareaRef.current.focus();
          // Move cursor to end of text
          const length = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(length, length);
        }
      }, 100);
    }
  }, [isEditMode, isClient, isLoading]);

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

    setIsLoading(true);
    setPushedPasteId(null); // Clear previous push success
    setText(getRandomLoadingJoke());

    try {
      // Small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));
      const result = await fetchPaste(id);
      
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
    } catch (error) {
      setText('Error: Failed to retrieve paste. Please check the ID and try again.');
      console.error('Error fetching paste:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle push button click - show encryption dialog or push directly
   */
  const handlePushButtonClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
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

    setIsPushing(true);
    setPushedPasteId(null);
    setUsedPassword(null);
    setShowEncryptDialog(false);

    try {
      let contentToStore = text;

      // Encrypt content if requested
      if (isEncrypted && password) {
        try {
          contentToStore = await encryptWithPassword(password, text);
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

      const result = await storePaste(
        contentToStore,
        recipientGhUsername,
        pasteName.trim() || null,
        userId,
        isEncrypted && password ? password : null
      );
      setPushedPasteId(result.id);
      
      // Clear paste name after successful push
      setPasteName('');

      // Update URL with new paste ID
      const url = new URL(window.location.href);
      url.searchParams.set('id', result.id);
      window.history.pushState({}, '', url);

      // Success popup will be shown automatically via pushedPasteId state
    } catch (error: any) {
      console.error('Error pushing paste:', error);
      alert(error.message || 'Failed to push paste. Please try again.');
    } finally {
      setIsPushing(false);
    }
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
      {/* Success Popup Modal for Push */}
      {pushedPasteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => {
          setPushedPasteId(null);
          setUsedPassword(null);
        }}>
          <div className="bg-surface border border-divider rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-positive-highlight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Paste Created Successfully!
                  {usedPassword && (
                    <span className="ml-2 text-xs bg-neon-magenta/20 text-neon-magenta px-2 py-0.5 rounded">
                      🔒 Encrypted
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setPushedPasteId(null);
                    setUsedPassword(null);
                  }}
                  className="text-text-secondary hover:text-text transition-colors"
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
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background border border-divider px-3 py-2 rounded font-mono text-sm text-text break-all">
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
                      className="px-3 py-2 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm"
                      title="Copy paste ID"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Share URL */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">
                    Share URL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background border border-divider px-3 py-2 rounded font-mono text-xs text-text break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}?id=${pushedPasteId}` : ''}
                    </code>
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-lg bg-positive-highlight text-black hover:opacity-90 transition-opacity text-sm font-medium flex items-center gap-2 whitespace-nowrap"
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
                          ⚠️ Save this password! You'll need it to decrypt the paste.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background border border-divider px-3 py-2 rounded font-mono text-sm text-text break-all">
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
                        className="px-3 py-2 rounded-lg bg-neon-magenta text-white hover:bg-neon-magenta-600 transition-colors text-sm"
                        title="Copy password"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setPushedPasteId(null);
                    setUsedPassword(null);
                  }}
                  className="px-6 py-2 rounded-lg bg-neon-cyan text-dark hover:bg-neon-cyan-600 transition-colors text-sm font-medium"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => {
          setShowPasswordPrompt(false);
          setPendingPasteData(null);
          setDecryptPassword('');
        }}>
          <div className="bg-surface border border-divider rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-neon-magenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password Required
                </h3>
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPendingPasteData(null);
                    setDecryptPassword('');
                  }}
                  className="text-text-secondary hover:text-text transition-colors"
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
                      className="w-full px-3 py-2 bg-background border border-divider rounded-lg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-neon-magenta focus:border-transparent text-sm"
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
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

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPendingPasteData(null);
                    setDecryptPassword('');
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecryptPaste}
                  disabled={!decryptPassword}
                  className="flex-1 px-4 py-2 rounded-lg bg-neon-magenta text-white hover:bg-neon-magenta-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowEncryptDialog(false)}>
          <div className="bg-surface border border-divider rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-neon-magenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Encrypt Paste
                </h3>
                <button
                  onClick={() => setShowEncryptDialog(false)}
                  className="text-text-secondary hover:text-text transition-colors"
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
                        className="w-full px-3 py-2 bg-background border border-divider rounded-lg text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-neon-magenta focus:border-transparent text-sm"
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

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEncryptDialog(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowEncryptDialog(false);
                    handlePushPaste(false, null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-surface-variant border border-divider text-text hover:bg-surface transition-colors text-sm font-medium"
                >
                  Push Without Encryption
                </button>
                <button
                  onClick={handleEncryptConfirm}
                  className="flex-1 px-4 py-2 rounded-lg bg-neon-magenta text-white hover:bg-neon-magenta-600 transition-colors text-sm font-medium"
                >
                  Push Encrypted
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pull/Push Section - Apple-inspired design */}
      <div className="border-b border-divider/50 w-full overflow-x-hidden">
        <div className="mx-auto px-4 sm:px-6 py-3 max-w-4xl">
          <div className="flex flex-col gap-3">
            {/* Main Controls Row */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
              {/* Paste ID Input */}
              <div className="flex-1 w-full min-w-0">
                <label htmlFor="paste-id-input" className="sr-only">Enter paste ID</label>
                <div className="relative w-full">
                  <input
                    id="paste-id-input"
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary/60 hover:text-text transition-colors p-1"
                      aria-label="Clear input"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Paste Name Input (optional, only for authenticated users) */}
              {user && (
                <div className="w-full sm:w-48 min-w-0">
                  <label htmlFor="paste-name-input" className="sr-only">Optional: Name your paste</label>
                  <input
                    id="paste-name-input"
                    type="text"
                    value={pasteName}
                    onChange={(e) => setPasteName(e.target.value)}
                    placeholder="Name your paste"
                    className="w-full px-3 py-2 bg-surface border border-divider/60 rounded-lg text-text placeholder:text-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-neon-teal focus:border-neon-teal transition-all duration-200 text-sm"
                  />
                </div>
              )}

              {/* Primary Action Buttons */}
              <div className="flex gap-2 w-full sm:w-auto">
                {/* Pull Button */}
                <button
                  onClick={handlePasteIdSubmit}
                  disabled={!isValidPasteId(pasteIdInput) || isLoading}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${
                      isValidPasteId(pasteIdInput) && !isLoading
                        ? 'bg-neon-cyan text-dark hover:opacity-90 active:scale-[0.98]'
                        : 'bg-surface-variant/50 text-text-secondary/70 border border-divider/60'
                    }
                  `}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-1.5">
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

                {/* Push Button with Dropdown */}
                <div ref={pushButtonRef} className="relative flex">
                  <button
                    onClick={handlePushButtonClick}
                    disabled={!text || text.trim().length === 0 || isPushing}
                    className={`
                      px-4 py-2 rounded-l-lg font-medium text-sm transition-all duration-200 whitespace-nowrap
                      disabled:opacity-40 disabled:cursor-not-allowed
                      ${
                        text && text.trim().length > 0 && !isPushing
                          ? 'bg-neon-magenta text-white hover:opacity-90 active:scale-[0.98]'
                          : 'bg-surface-variant/50 text-text-secondary/70 border border-divider/60'
                      }
                    `}
                  >
                    {isPushing ? (
                      <span className="flex items-center gap-1.5">
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
                      onClick={() => setShowEncryptDialog(true)}
                      className="px-2 py-2 rounded-r-lg border-l border-white/20 transition-all duration-200 push-dropdown-arrow bg-neon-magenta text-white hover:opacity-90"
                      aria-label="Encryption options"
                      title="Encryption options"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="text/*,.txt,.json,.js,.ts,.jsx,.tsx,.css,.html,.md,.py,.java,.cpp,.c,.go,.rs,.php,.rb,.swift,.kt,.scala,.sh,.yaml,.yml,.xml,.sql"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="File upload input"
                />

                {/* Utility Buttons - compact icon buttons */}
                <div className="flex gap-1.5">
                  {/* Upload Button */}
                  <button
                    onClick={handleFileUpload}
                    className="px-2.5 py-2 rounded-lg bg-surface-variant/50 border border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant transition-all duration-200 active:scale-[0.98]"
                    aria-label="Upload file"
                    title="Upload file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </button>

                  {/* Download Button - only shown when text exists */}
                  {text && (
                    <button
                      onClick={handleDownload}
                      className="px-2.5 py-2 rounded-lg bg-surface-variant/50 border border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant transition-all duration-200 active:scale-[0.98]"
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

                  {/* Copy Button - only shown when text exists */}
                  {text && (
                    <button
                      onClick={handleCopy}
                      className="px-2.5 py-2 rounded-lg bg-surface-variant/50 border border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant transition-all duration-200 active:scale-[0.98]"
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
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Controls Row - always shown when not loading */}
            {!isLoading && (
              <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-divider/30">
                {/* Language Selector - only shown when text exists */}
                {text && (
                  <div className="relative">
                    <label htmlFor="language-select" className="sr-only">Select syntax highlighting language</label>
                    <select
                      id="language-select"
                      value={selectedLanguage}
                      onChange={(e) => {
                        setSelectedLanguage(e.target.value as LanguageValue);
                        setIsManualLanguageSelection(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-variant border border-divider/60 text-text hover:bg-surface transition-all duration-200 text-sm font-medium cursor-pointer appearance-none pr-7 focus:outline-none focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan [&>option]:bg-surface [&>option]:text-text [&>option:checked]:bg-positive-highlight [&>option:checked]:text-dark"
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
                )}

                {/* Edit/View Mode Toggle - always visible */}
                <button
                  onClick={() => {
                    setIsEditMode(!isEditMode);
                    // Auto-focus textarea when switching to edit mode
                    if (!isEditMode && textareaRef.current) {
                      setTimeout(() => {
                        textareaRef.current?.focus();
                      }, 100);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-variant/50 border border-divider/60 text-text-secondary hover:text-text hover:bg-surface-variant transition-all duration-200 active:scale-[0.98]"
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative w-full">
        {isEditMode ? (
          // Edit mode: plain textarea
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={isLoading}
            className="w-full h-full min-h-[60vh] bg-background text-text font-mono text-sm sm:text-base p-4 sm:p-6 lg:p-8 resize-none outline-none leading-relaxed focus:outline-none focus:ring-0 border-0 cursor-text"
            style={{ minHeight: '60vh' }}
            spellCheck={false}
            placeholder="Start typing or paste your content here..."
            autoFocus
          />
        ) : (
          // View mode: syntax highlighting
          <div className="w-full h-full min-h-[60vh] overflow-auto">
            {text ? (
              <SyntaxHighlighter
                language={selectedLanguage === 'text' ? 'plaintext' : selectedLanguage}
                style={resolvedTheme === 'dark' ? vscDarkPlus : vs}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem 1.5rem 1.5rem 1.5rem',
                  background: 'var(--color-background)',
                  fontSize: '0.875rem',
                  lineHeight: '1.75rem',
                  fontFamily: 'var(--font-mono), monospace',
                  borderRadius: 0,
                  maxWidth: '100%',
                  overflow: 'auto',
                }}
                codeTagProps={{
                  style: {
                    fontFamily: 'var(--font-mono), monospace',
                  }
                }}
                showLineNumbers={text.split('\n').length > 1}
                lineNumberStyle={{
                  minWidth: '3em',
                  paddingRight: '1em',
                  color: 'var(--color-text-secondary)',
                  userSelect: 'none',
                }}
                wrapLines
                wrapLongLines
              >
                {text}
              </SyntaxHighlighter>
            ) : (
              <div className="w-full h-full min-h-[60vh] flex items-center justify-center p-8">
                <p className="text-text-secondary text-sm">Paste content will appear here...</p>
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