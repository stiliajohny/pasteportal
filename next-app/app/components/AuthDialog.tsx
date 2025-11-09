'use client';

import { validateEmail, validatePassword } from '@/lib/auth-utils';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'signin' | 'signup' | 'magic-link' | 'reset-password' | 'otp';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  onUserInteraction?: () => void;
  isVSCodeAuth?: boolean;
  customTitle?: string;
  customDescription?: string;
}

/**
 * Authentication dialog component
 * Supports email/password, magic link, password reset, OTP, Web3, and GitHub
 */
export default function AuthDialog({ isOpen, onClose, initialMode = 'signin', onUserInteraction, isVSCodeAuth = false, customTitle, customDescription }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const { signOut } = useAuth();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setError(null);
    setMessage(null);
    setPasswordErrors([]);
    setAcceptedTerms(false);
    setAcceptedPrivacy(false);
  };

  // Sync mode with initialMode prop when it changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      resetForm();
    }
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const supabase = createClient();

  // Get default title based on mode
  const getDefaultTitle = () => {
    if (mode === 'signup') return 'Sign Up';
    if (mode === 'signin') return 'Sign In';
    if (mode === 'magic-link') return 'Magic Link';
    if (mode === 'reset-password') return 'Reset Password';
    if (mode === 'otp') return 'Enter OTP';
    return 'Sign In';
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPasswordErrors([]);

    // Validate email
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors);
      setError('Please fix password requirements');
      return;
    }

    // Check password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate Terms and Privacy acceptance
    if (!acceptedTerms) {
      setError('You must accept the Terms and Conditions to sign up');
      return;
    }

    if (!acceptedPrivacy) {
      setError('You must accept the Privacy Policy to sign up');
      return;
    }

    setLoading(true);
    
    // Notify parent that user has interacted (for VS Code auth flow)
    if (onUserInteraction) {
      onUserInteraction();
    }
    
    try {
      // Extract username from email (part before @)
      const defaultUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      const defaultDisplayName = email.split('@')[0];
      
      // Configure email redirect URL for VS Code auth flow
      const signUpOptions: any = {
        data: {
          display_name: defaultDisplayName,
          username: defaultUsername,
          terms_accepted: true,
          privacy_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
        },
      };

      // If signing up from VS Code auth page, set email redirect to VS Code callback
      if (isVSCodeAuth) {
        // Set emailRedirectTo to VS Code callback URL
        // This will make the email verification link redirect back to VS Code
        signUpOptions.emailRedirectTo = `${window.location.origin}/auth/callback?vscode=true`;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: signUpOptions,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        // Check if session was created (email confirmation might not be required)
        if (data.session) {
          // Session created immediately - user is authenticated
          // The auth state change listener will handle redirect
          setMessage('Account created successfully! Redirecting...');
        } else {
          // Email confirmation required
          if (isVSCodeAuth) {
            // For VS Code: Don't redirect immediately, just show message
            // The email verification link will redirect back to VS Code
            setMessage('Account created! Please check your email and click the confirmation link. After confirming, you will be redirected back to VS Code automatically.');
          } else {
            setMessage('Check your email to confirm your account');
            setTimeout(() => {
              setMode('signin');
              resetForm();
            }, 3000);
          }
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    
    // Notify parent that user has interacted (for VS Code auth flow)
    if (onUserInteraction) {
      onUserInteraction();
    }
    
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        onClose();
        resetForm();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Use VS Code callback URL if on VS Code auth page, otherwise normal callback
      const redirectTo = isVSCodeAuth 
        ? `${window.location.origin}/auth/vscode`
        : `${window.location.origin}/auth/callback`;
        
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (magicLinkError) {
        setError(magicLinkError.message);
      } else {
        setMessage('Check your email for the magic link');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage('Check your email for password reset instructions');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!otp) {
      setError('Please enter the OTP code');
      return;
    }

    if (!email) {
      setError('Email is required for OTP verification');
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        onClose();
        resetForm();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError(null);
    setMessage(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        setMessage('OTP sent to your email');
        setMode('otp');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setError(null);
    
    // For signup mode, require Terms and Privacy acceptance
    if (mode === 'signup') {
      if (!acceptedTerms) {
        setError('You must accept the Terms and Conditions to sign up');
        return;
      }
      if (!acceptedPrivacy) {
        setError('You must accept the Privacy Policy to sign up');
        return;
      }
      // Store acceptance in localStorage to retrieve after OAuth callback
      localStorage.setItem('pending_terms_accepted', 'true');
      localStorage.setItem('pending_privacy_accepted', 'true');
      localStorage.setItem('pending_terms_accepted_at', new Date().toISOString());
      localStorage.setItem('pending_privacy_accepted_at', new Date().toISOString());
    }
    
    setLoading(true);
    try {
      // Use VS Code callback URL if on VS Code auth page, otherwise normal callback
      // IMPORTANT: For VS Code auth, we MUST redirect back to /auth/vscode to ensure
      // the PKCE code verifier in sessionStorage is accessible
      const redirectTo = isVSCodeAuth 
        ? `${window.location.origin}/auth/vscode`
        : `${window.location.origin}/auth/callback`;
      
      // Store the redirect URL in localStorage so callback pages know where to redirect
      if (isVSCodeAuth) {
        localStorage.setItem('vscode_oauth_redirect', redirectTo);
      }
      
      // Debug: Log storage state before OAuth initiation
      if (typeof window !== 'undefined') {
        console.log('[AuthDialog] SessionStorage keys before OAuth:', Object.keys(window.sessionStorage));
        console.log('[AuthDialog] LocalStorage keys before OAuth:', Object.keys(window.localStorage));
      }
        
      // Ensure we're using a fresh Supabase client instance for OAuth
      // This ensures the PKCE code verifier is properly stored in sessionStorage
      console.log('[AuthDialog] Calling signInWithOAuth...');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectTo,
          // Ensure PKCE is enabled (should be default, but explicit is better)
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      console.log('[AuthDialog] signInWithOAuth result:', { hasData: !!data, hasUrl: !!data?.url, hasError: !!oauthError });

      if (oauthError) {
        console.error('[AuthDialog] OAuth error:', oauthError);
        setError(oauthError.message);
        setLoading(false);
      } else if (data?.url) {
        // Debug: Log storage state after OAuth initiation
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            console.log('[AuthDialog] SessionStorage keys after OAuth initiation:', Object.keys(window.sessionStorage));
            console.log('[AuthDialog] LocalStorage keys after OAuth initiation:', Object.keys(window.localStorage));
            
            // Check if our fixed key exists
            const fixedKey = 'supabase-pkce-code-verifier';
            const hasSession = window.sessionStorage.getItem(fixedKey);
            const hasLocal = window.localStorage.getItem(fixedKey);
            console.log(`[AuthDialog] Fixed code verifier key in sessionStorage: ${hasSession ? 'YES' : 'NO'}`);
            console.log(`[AuthDialog] Fixed code verifier key in localStorage: ${hasLocal ? 'YES' : 'NO'}`);
          }, 200);
        }
        
        console.log('[AuthDialog] Redirecting to GitHub:', data.url);
        // Redirect to GitHub OAuth
        window.location.href = data.url;
      } else {
        console.error('[AuthDialog] No URL returned from signInWithOAuth');
        setError('Failed to initiate GitHub sign in');
        setLoading(false);
      }
      // User will be redirected to GitHub
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  /**
   * Detect available Ethereum wallets
   * Checks for MetaMask, Coinbase Wallet, and other EIP-1193 compatible wallets
   */
  const detectEthereumWallet = (): { wallet: any; name: string } | null => {
    if (typeof window === 'undefined') return null;

    const win = window as any;

    // Check for MetaMask (most common)
    if (win.ethereum?.isMetaMask) {
      return { wallet: win.ethereum, name: 'MetaMask' };
    }

    // Check for Coinbase Wallet
    if (win.ethereum?.isCoinbaseWallet) {
      return { wallet: win.ethereum, name: 'Coinbase Wallet' };
    }

    // Check for any EIP-1193 compatible provider
    if (win.ethereum && typeof win.ethereum.request === 'function') {
      // Try to detect the wallet name
      const providerName = win.ethereum.providerName || 
                          win.ethereum.constructor?.name || 
                          'Ethereum Wallet';
      return { wallet: win.ethereum, name: providerName };
    }

    // Check for legacy providers
    if (win.web3?.currentProvider) {
      return { wallet: win.web3.currentProvider, name: 'Legacy Web3' };
    }

    return null;
  };

  /**
   * Detect available Solana wallets
   * Checks for Phantom, Solflare, and other Solana wallet adapters
   */
  const detectSolanaWallet = (): { wallet: any; name: string } | null => {
    if (typeof window === 'undefined') return null;

    const win = window as any;

    // Check for Phantom (most common)
    if (win.solana?.isPhantom) {
      return { wallet: win.solana, name: 'Phantom' };
    }

    // Check for Solflare
    if (win.solana?.isSolflare) {
      return { wallet: win.solana, name: 'Solflare' };
    }

    // Check for any Solana wallet adapter
    if (win.solana && typeof win.solana.connect === 'function') {
      return { wallet: win.solana, name: 'Solana Wallet' };
    }

    return null;
  };

  const handleWeb3SignIn = async (chain: 'ethereum' | 'solana') => {
    setError(null);
    setMessage(null);
    setLoading(true);
    
    try {
      if (typeof window === 'undefined') {
        setError('Web3 authentication is only available in the browser.');
        setLoading(false);
        return;
      }

      let wallet: any = null;
      let walletName = '';

      // Check if wallet is available and connect
      if (chain === 'ethereum') {
        const detected = detectEthereumWallet();
        
        if (!detected) {
          setError(
            'No Ethereum wallet detected. Please install a wallet extension like MetaMask or Coinbase Wallet, then refresh this page.'
          );
          setLoading(false);
          // Log helpful links to console for developers
          console.info('Ethereum wallet installation links:\n' +
            '• MetaMask: https://metamask.io\n' +
            '• Coinbase Wallet: https://wallet.coinbase.com');
          return;
        }

        wallet = detected.wallet;
        walletName = detected.name;

        try {
          // Request account access
          setMessage(`Connecting to ${walletName}...`);
          await wallet.request({ method: 'eth_requestAccounts' });
        } catch (walletError: any) {
          if (walletError.code === 4001) {
            setError('Wallet connection was rejected. Please approve the connection request in your wallet.');
          } else {
            setError(`Failed to connect to ${walletName}: ${walletError.message || 'Unknown error'}`);
          }
          setLoading(false);
          return;
        }
      } else if (chain === 'solana') {
        const detected = detectSolanaWallet();
        
        if (!detected) {
          setError(
            'No Solana wallet detected. Please install a wallet extension like Phantom or Solflare, then refresh this page.'
          );
          setLoading(false);
          // Log helpful links to console for developers
          console.info('Solana wallet installation links:\n' +
            '• Phantom: https://phantom.app\n' +
            '• Solflare: https://solflare.com');
          return;
        }

        wallet = detected.wallet;
        walletName = detected.name;

        try {
          // Connect to Solana wallet
          setMessage(`Connecting to ${walletName}...`);
          await wallet.connect();
        } catch (walletError: any) {
          if (walletError.code === 4001) {
            setError('Wallet connection was rejected. Please approve the connection request in your wallet.');
          } else {
            setError(`Failed to connect to ${walletName}: ${walletError.message || 'Unknown error'}`);
          }
          setLoading(false);
          return;
        }
      }

      // For signup mode, require Terms and Privacy acceptance
      if (mode === 'signup') {
        if (!acceptedTerms) {
          setError('You must accept the Terms and Conditions to sign up');
          setLoading(false);
          return;
        }
        if (!acceptedPrivacy) {
          setError('You must accept the Privacy Policy to sign up');
          setLoading(false);
          return;
        }
        // Store acceptance in localStorage to retrieve after OAuth callback
        localStorage.setItem('pending_terms_accepted', 'true');
        localStorage.setItem('pending_privacy_accepted', 'true');
        localStorage.setItem('pending_terms_accepted_at', new Date().toISOString());
        localStorage.setItem('pending_privacy_accepted_at', new Date().toISOString());
      }

      // Now sign in with Web3 using the connected wallet
      setMessage(`Authenticating with ${walletName}...`);
      
      // Check if signInWithWeb3 is available
      if (!supabase.auth.signInWithWeb3) {
        setError('Web3 authentication is not available. Please ensure your Supabase project supports Web3 authentication.');
        setLoading(false);
        console.error('signInWithWeb3 method not available on supabase.auth');
        return;
      }
      
      // Supabase uses window.location.origin in the EIP-4361 message signature
      // The origin MUST match what's configured in Supabase Dashboard:
      // Dashboard > Authentication > URL Configuration > Redirect URLs
      // 
      // If you're getting "URI not allowed" errors, ensure your current origin
      // (shown below) is added to Supabase Redirect URLs
      const currentOrigin = window.location.origin;
      if (process.env.NODE_ENV === 'development') {
        console.log('Web3 Auth - Current origin:', currentOrigin);
        console.log('Web3 Auth - Ensure this origin is in Supabase Redirect URLs');
        console.log('Web3 Auth - Wallet:', walletName, 'Chain:', chain);
      }
      
      // Supabase signInWithWeb3 currently only supports Ethereum
      if (chain !== 'ethereum') {
        setError(`Web3 authentication for ${chain} is not yet supported. Please use Ethereum.`);
        setLoading(false);
        return;
      }
      
      let web3Result;
      try {
        const web3Options = {
          chain: chain as 'ethereum',
          wallet: wallet,
          statement: 'I accept the Terms of Service',
        };
        
        console.log('Web3 Auth - Calling signInWithWeb3 with options:', {
          chain: web3Options.chain,
          hasWallet: !!web3Options.wallet,
          statement: web3Options.statement,
        });
        
        web3Result = await supabase.auth.signInWithWeb3(web3Options);
        
        console.log('Web3 Auth - signInWithWeb3 result:', {
          hasData: !!web3Result?.data,
          hasError: !!web3Result?.error,
          errorMessage: web3Result?.error?.message,
        });
      } catch (signInError: any) {
        // Catch any errors during the signInWithWeb3 call itself
        console.error('Web3 signInWithWeb3 call error:', signInError);
        console.error('Error details:', {
          message: signInError?.message,
          code: signInError?.code,
          name: signInError?.name,
          stack: signInError?.stack,
          fullError: JSON.stringify(signInError, Object.getOwnPropertyNames(signInError)),
        });
        
        const errorMsg = signInError?.message || 
                        signInError?.error?.message ||
                        signInError?.toString() || 
                        'Web3 authentication failed. Please try again.';
        setError(`Web3 authentication error: ${errorMsg}`);
        setLoading(false);
        return;
      }

      const { data, error: web3Error } = web3Result || {};

      if (web3Error) {
        console.error('Web3 auth error:', web3Error);
        console.error('Error details:', {
          message: web3Error?.message,
          status: web3Error?.status,
          name: web3Error?.name,
          fullError: JSON.stringify(web3Error, Object.getOwnPropertyNames(web3Error)),
        });
        
        const errorMsg = web3Error.message || 'Web3 authentication failed. Please try again.';
        
        // Provide specific guidance for URI mismatch errors
        if (errorMsg.includes('URI') && errorMsg.includes('not allowed')) {
          setError(
            `Domain mismatch: The current origin (${currentOrigin}) is not configured in Supabase. ` +
            `Please add this origin to Supabase Dashboard > Authentication > URL Configuration > Redirect URLs. ` +
            `You can use a wildcard pattern like ${currentOrigin}/** to allow all paths.`
          );
        } else {
          setError(errorMsg);
        }
        setLoading(false);
        return;
      }

      // If successful, the user will be redirected or session will be set
      setMessage('Authentication successful!');
    } catch (err: any) {
      console.error('Web3 auth exception:', err);
      console.error('Exception details:', {
        message: err?.message,
        code: err?.code,
        name: err?.name,
        stack: err?.stack,
        error: err?.error,
        fullError: JSON.stringify(err, Object.getOwnPropertyNames(err)),
      });
      
      // Try to extract error message from various possible locations
      const errorMessage = err?.message || 
                          err?.error?.message ||
                          err?.error?.error_description ||
                          err?.toString() || 
                          'An unexpected error occurred';
      setError(`Web3 authentication error: ${errorMessage}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-surface border border-divider rounded-lg shadow-xl">
        {/* Close Button - Hidden for VS Code auth */}
        {!isVSCodeAuth && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-text-secondary hover:text-text transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="p-6">
          {/* Header */}
          {isVSCodeAuth ? (
            <div className="mb-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                {/* VS Code Icon */}
                <div className="flex-shrink-0">
                  <svg
                    className="w-12 h-12"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect width="24" height="24" rx="2" fill="#007ACC" />
                    <path
                      d="M16.5 6.5L9 14L5.5 10.5L4 12L9 17L18 8L16.5 6.5Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text">
                    {mode === 'signup' && 'Sign Up for VS Code'}
                    {mode === 'signin' && 'Sign In to VS Code'}
                    {mode === 'magic-link' && 'Magic Link'}
                    {mode === 'reset-password' && 'Reset Password'}
                    {mode === 'otp' && 'Enter OTP'}
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Authenticate with PastePortal
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-text">
                {customTitle || getDefaultTitle()}
              </h2>
              {customDescription && (
                <div className="mt-3 p-4 bg-positive-highlight/10 border border-positive-highlight/30 rounded-lg">
                  <div className="text-sm text-text leading-relaxed space-y-2">
                    {customDescription.split('\n').map((line, index) => {
                      // Check if line is a bullet point
                      if (line.trim().startsWith('•')) {
                        return (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-positive-highlight mt-0.5">•</span>
                            <span>{line.trim().substring(1).trim()}</span>
                          </div>
                        );
                      }
                      // Regular line
                      if (line.trim()) {
                        return (
                          <p key={index} className={index === 0 ? 'font-medium' : ''}>
                            {line.trim()}
                          </p>
                        );
                      }
                      // Empty line (spacing)
                      return <br key={index} />;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
              {message}
            </div>
          )}

          {/* Forms */}
          {mode === 'signup' && (
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div>
                <label htmlFor="email-signup" className="block text-sm font-medium mb-2 text-text">
                  Email
                </label>
                <input
                  id="email-signup"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label htmlFor="password-signup" className="block text-sm font-medium mb-2 text-text">
                  Password
                </label>
                <input
                  id="password-signup"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                  placeholder="••••••••"
                />
                {passwordErrors.length > 0 && (
                  <ul className="mt-2 text-xs text-text-secondary list-disc list-inside">
                    {passwordErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-2 text-text">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                  placeholder="••••••••"
                />
              </div>
              
              {/* Terms and Privacy Acceptance */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-divider bg-surface-variant text-positive-highlight focus:ring-2 focus:ring-positive-highlight focus:ring-offset-0 cursor-pointer"
                    required
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text transition-colors">
                    I accept the{' '}
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-positive-highlight hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms and Conditions
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-divider bg-surface-variant text-positive-highlight focus:ring-2 focus:ring-positive-highlight focus:ring-offset-0 cursor-pointer"
                    required
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text transition-colors">
                    I accept the{' '}
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-positive-highlight hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !acceptedTerms || !acceptedPrivacy}
                className="w-full px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing up...' : 'Sign Up'}
              </button>
              <p className="text-sm text-center text-text-secondary">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    resetForm();
                  }}
                  className="text-positive-highlight hover:underline"
                >
                  Sign In
                </button>
              </p>
            </form>
          )}

          {mode === 'signin' && (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label htmlFor="email-signin" className="block text-sm font-medium mb-2 text-text">
                  Email
                </label>
                <input
                  id="email-signin"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label htmlFor="password-signin" className="block text-sm font-medium mb-2 text-text">
                  Password
                </label>
                <input
                  id="password-signin"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              {!isVSCodeAuth && (
                <>
                  <div className="flex justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('magic-link');
                        resetForm();
                      }}
                      className="text-positive-highlight hover:underline"
                    >
                      Use Magic Link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset-password');
                        resetForm();
                      }}
                      className="text-positive-highlight hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={!email || !validateEmail(email) || loading}
                      className="text-sm text-positive-highlight hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sign in with OTP
                    </button>
                  </div>
                </>
              )}
              <p className="text-sm text-center text-text-secondary">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    resetForm();
                  }}
                  className="text-positive-highlight hover:underline"
                >
                  Sign Up
                </button>
              </p>
            </form>
          )}

          {mode === 'magic-link' && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="email-magic" className="block text-sm font-medium mb-2 text-text">
                  Email
                </label>
                <input
                  id="email-magic"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                  placeholder="your@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={!email || !validateEmail(email) || loading}
                  className="text-sm text-positive-highlight hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Or use OTP code instead
                </button>
              </div>
              <p className="text-sm text-center text-text-secondary">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    resetForm();
                  }}
                  className="text-positive-highlight hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          )}

          {mode === 'reset-password' && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label htmlFor="email-reset" className="block text-sm font-medium mb-2 text-text">
                  Email
                </label>
                <input
                  id="email-reset"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight"
                  placeholder="your@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <p className="text-sm text-center text-text-secondary">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    resetForm();
                  }}
                  className="text-positive-highlight hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleOtp} className="space-y-4">
              <div>
                <label htmlFor="otp-code" className="block text-sm font-medium mb-2 text-text">
                  OTP Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text focus:outline-none focus:ring-2 focus:ring-positive-highlight text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-positive-highlight text-black font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          )}

          {/* Divider */}
          {mode !== 'otp' && mode !== 'reset-password' && (
            <div className="my-6 flex items-center">
              <div className="flex-1 border-t border-divider"></div>
              <span className="px-4 text-sm text-text-secondary">OR</span>
              <div className="flex-1 border-t border-divider"></div>
            </div>
          )}

          {/* OAuth Providers */}
          {mode !== 'otp' && mode !== 'reset-password' && (
            <div className="space-y-3">
              <button
                onClick={handleGitHubSignIn}
                disabled={loading || (mode === 'signup' && (!acceptedTerms || !acceptedPrivacy))}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text font-medium hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Continue with GitHub
              </button>

              <button
                onClick={() => handleWeb3SignIn('ethereum')}
                disabled={loading || (mode === 'signup' && (!acceptedTerms || !acceptedPrivacy))}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text font-medium hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
                </svg>
                Continue with Ethereum
              </button>

              <button
                onClick={() => handleWeb3SignIn('solana')}
                disabled={loading || (mode === 'signup' && (!acceptedTerms || !acceptedPrivacy))}
                className="w-full px-4 py-2 bg-surface-variant border border-divider rounded text-text font-medium hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.5 16.5c-1.5 0-2.25-1.5-1.5-3l3-9c.75-1.5 2.25-1.5 3 0l3 9c.75 1.5 0 3-1.5 3h-5.25zm2.25-4.5h2.25l-1.125-3.375L6.75 12z" />
                </svg>
                Continue with Solana
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
