const vscode = require('vscode')
const { createClient } = require('@supabase/supabase-js')
const SecureStorage = require('./secure-storage')

/**
 * Storage keys for secure token storage
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'pasteportal.access_token',
  REFRESH_TOKEN: 'pasteportal.refresh_token',
  USER_ID: 'pasteportal.user_id',
  USER_EMAIL: 'pasteportal.user_email',
  SESSION_DATA: 'pasteportal.session_data'
}

/**
 * Authentication module for PastePortal
 * Handles Supabase authentication with secure token storage
 */
class Auth {
  /**
   * Create a new Auth instance
   * @param {SecureStorage} secureStorage - Secure storage instance
   */
  constructor(secureStorage) {
    if (!secureStorage) {
      throw new Error('SecureStorage instance is required')
    }
    this.secureStorage = secureStorage
    this.supabaseClient = null
    this.currentSession = null
    this._initializeSupabase()
  }

  /**
   * Initialize Supabase client with configuration
   * @private
   */
  _initializeSupabase() {
    const config = vscode.workspace.getConfiguration('pasteportal')
    const supabaseUrl = config.get('supabase.url', '')
    const supabaseAnonKey = config.get('supabase.anonKey', '')

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase configuration not found. Authentication features will not work.')
      return
    }

    try {
      this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
      // Set up auth state change listener
      this.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          this.currentSession = session
          if (session) {
            this._saveSession(session)
          } else {
            this._clearSession()
          }
        }
      })
    } catch (error) {
      console.error('Error initializing Supabase client:', error.message)
    }
  }

  /**
   * Check if Supabase is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.supabaseClient !== null
  }

  /**
   * Save session data to secure storage
   * @private
   * @param {Object} session - Supabase session object
   */
  async _saveSession(session) {
    if (!session) {
      return
    }

    try {
      await this.secureStorage.storeToken(STORAGE_KEYS.ACCESS_TOKEN, session.access_token)
      await this.secureStorage.storeToken(STORAGE_KEYS.REFRESH_TOKEN, session.refresh_token)
      await this.secureStorage.storeToken(STORAGE_KEYS.USER_ID, session.user?.id || '')
      await this.secureStorage.storeToken(STORAGE_KEYS.USER_EMAIL, session.user?.email || '')
      
      // Store full session as JSON (for user metadata, etc.)
      const sessionData = {
        user: {
          id: session.user?.id,
          email: session.user?.email,
          user_metadata: session.user?.user_metadata || {}
        },
        expires_at: session.expires_at,
        expires_in: session.expires_in
      }
      await this.secureStorage.storeToken(STORAGE_KEYS.SESSION_DATA, JSON.stringify(sessionData))
      
      this.currentSession = session
    } catch (error) {
      console.error('Error saving session:', error.message)
      throw error
    }
  }

  /**
   * Clear all session data from secure storage
   * @private
   */
  async _clearSession() {
    try {
      await this.secureStorage.clearTokens([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.SESSION_DATA
      ])
      this.currentSession = null
    } catch (error) {
      console.error('Error clearing session:', error.message)
    }
  }

  /**
   * Load session from secure storage
   * @private
   * @returns {Promise<Object|null>}
   */
  async _loadSession() {
    try {
      const accessToken = await this.secureStorage.getToken(STORAGE_KEYS.ACCESS_TOKEN)
      const refreshToken = await this.secureStorage.getToken(STORAGE_KEYS.REFRESH_TOKEN)

      if (!accessToken || !refreshToken) {
        return null
      }

      // Reconstruct session object
      const sessionDataStr = await this.secureStorage.getToken(STORAGE_KEYS.SESSION_DATA)
      const sessionData = sessionDataStr ? JSON.parse(sessionDataStr) : null

      if (!sessionData) {
        return null
      }

      // Set session in Supabase client - this will validate it
      if (this.supabaseClient) {
        const { data: { session }, error } = await this.supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (error) {
          console.error('Error setting session:', error.message)
          // If session is invalid, try to refresh it
          const refreshed = await this.refreshSession()
          if (refreshed) {
            return refreshed
          }
          // If refresh also failed, clear stored tokens
          await this._clearSession()
          return null
        }

        // Check if session is expired, refresh if needed
        if (session && session.expires_at) {
          const expiresAt = session.expires_at * 1000
          const now = Date.now()
          if (expiresAt <= now) {
            // Session expired, try to refresh
            const refreshed = await this.refreshSession()
            if (refreshed) {
              this.currentSession = refreshed
              return refreshed
            }
          }
        }

        this.currentSession = session
        return session
      }

      return null
    } catch (error) {
      console.error('Error loading session:', error.message)
      await this._clearSession()
      return null
    }
  }

  /**
   * Authenticate user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{session: Object, user: Object}>}
   * @throws {Error}
   */
  async authenticateWithEmail(email, password) {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
    }

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required')
    }

    if (!password || typeof password !== 'string') {
      throw new Error('Password is required')
    }

    try {
      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      })

      if (error) {
        throw new Error(error.message)
      }

      if (!data.session) {
        throw new Error('Authentication failed: No session returned')
      }

      // Check if account is disabled
      if (data.user?.user_metadata?.account_disabled) {
        await this.signOut()
        throw new Error('Account is disabled')
      }

      await this._saveSession(data.session)

      return {
        session: data.session,
        user: data.user
      }
    } catch (error) {
      console.error('Authentication error:', error.message)
      throw error
    }
  }

  /**
   * Sign up new user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{user: Object, message: string}>}
   * @throws {Error}
   */
  async signUpWithEmail(email, password) {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
    }

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required')
    }

    if (!password || typeof password !== 'string') {
      throw new Error('Password is required')
    }

    try {
      // Extract username from email (part before @)
      const defaultUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
      const defaultDisplayName = email.split('@')[0]

      const { data, error } = await this.supabaseClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            display_name: defaultDisplayName,
            username: defaultUsername,
            terms_accepted: true,
            privacy_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            privacy_accepted_at: new Date().toISOString()
          }
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      // Note: Supabase may require email confirmation before returning a session
      // If session is null, user needs to confirm email
      if (data.session) {
        await this._saveSession(data.session)
      }

      return {
        user: data.user,
        message: data.session
          ? 'Account created successfully'
          : 'Account created. Please check your email to confirm your account.'
      }
    } catch (error) {
      console.error('Sign up error:', error.message)
      throw error
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      if (this.supabaseClient) {
        await this.supabaseClient.auth.signOut()
      }
      await this._clearSession()
    } catch (error) {
      console.error('Sign out error:', error.message)
      // Clear session even if sign out fails
      await this._clearSession()
    }
  }

  /**
   * Get current session
   * @returns {Promise<Object|null>}
   */
  async getSession() {
    if (this.currentSession) {
      // Check if session is still valid
      if (this.currentSession.expires_at && this.currentSession.expires_at * 1000 > Date.now()) {
        return this.currentSession
      }
      // Try to refresh if expired
      return await this.refreshSession()
    }

    // Try to load from storage
    return await this._loadSession()
  }

  /**
   * Refresh expired session
   * @returns {Promise<Object|null>}
   */
  async refreshSession() {
    if (!this.isConfigured()) {
      return null
    }

    try {
      const refreshToken = await this.secureStorage.getToken(STORAGE_KEYS.REFRESH_TOKEN)
      if (!refreshToken) {
        return null
      }

      const { data, error } = await this.supabaseClient.auth.refreshSession({
        refresh_token: refreshToken
      })

      if (error) {
        console.error('Error refreshing session:', error.message)
        await this._clearSession()
        return null
      }

      if (data.session) {
        await this._saveSession(data.session)
        return data.session
      }

      return null
    } catch (error) {
      console.error('Error refreshing session:', error.message)
      await this._clearSession()
      return null
    }
  }

  /**
   * Check if user is authenticated by attempting to get session
   * This will also try to refresh the session if it's expired
   * @returns {Promise<boolean>}
   */
  async checkAuthenticationStatus() {
    try {
      // Try to get current session (this will also refresh if needed)
      const session = await this.getSession()
      return session !== null && session.user !== null
    } catch (error) {
      console.error('Error checking authentication status:', error.message)
      return false
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const session = await this.getSession()
    return session !== null && session.user !== null
  }

  /**
   * Get current user
   * @returns {Promise<Object|null>}
   */
  async getCurrentUser() {
    const session = await this.getSession()
    return session?.user || null
  }

  /**
   * Get access token for API requests
   * @returns {Promise<string|null>}
   */
  async getAccessToken() {
    const session = await this.getSession()
    if (!session) {
      return null
    }

    // Refresh if needed (within 5 minutes of expiration)
    const expiresAt = session.expires_at * 1000
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    if (expiresAt - now < fiveMinutes) {
      const refreshed = await this.refreshSession()
      return refreshed?.access_token || session.access_token
    }

    return session.access_token
  }

  /**
   * Send magic link to email
   * @param {string} email - User email
   * @returns {Promise<{message: string}>}
   * @throws {Error}
   */
  async sendMagicLink(email) {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
    }

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required')
    }

    try {
      // For VS Code, we'll use the website authentication flow instead
      // Open the website auth page which will handle the magic link flow
      const vscode = require('vscode')
      const config = vscode.workspace.getConfiguration('pasteportal')
      const domain = config.get('domain', 'https://pasteportal.app')
      
      // Open website authentication page for magic link
      await vscode.env.openExternal(vscode.Uri.parse(`${domain}/auth/vscode?mode=signin`))

      return {
        message: 'Opening website for authentication. Use the magic link option on the website to sign in.'
      }
    } catch (error) {
      console.error('Magic link error:', error.message)
      throw error
    }
  }

  /**
   * Request OTP code via email
   * @param {string} email - User email
   * @returns {Promise<{message: string}>}
   * @throws {Error}
   */
  async requestOtp(email) {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
    }

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required')
    }

    try {
      const { error } = await this.supabaseClient.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        message: 'OTP code sent! Check your email for the verification code.'
      }
    } catch (error) {
      console.error('OTP request error:', error.message)
      throw error
    }
  }

  /**
   * Verify OTP code
   * @param {string} email - User email
   * @param {string} token - OTP token
   * @returns {Promise<{session: Object, user: Object}>}
   * @throws {Error}
   */
  async verifyOtp(email, token) {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
    }

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required')
    }

    if (!token || typeof token !== 'string') {
      throw new Error('OTP code is required')
    }

    try {
      const { data, error } = await this.supabaseClient.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email'
      })

      if (error) {
        throw new Error(error.message)
      }

      if (!data.session) {
        throw new Error('Authentication failed: No session returned')
      }

      // Check if account is disabled
      if (data.user?.user_metadata?.account_disabled) {
        await this.signOut()
        throw new Error('Account is disabled')
      }

      await this._saveSession(data.session)

      return {
        session: data.session,
        user: data.user
      }
    } catch (error) {
      console.error('OTP verification error:', error.message)
      throw error
    }
  }


  /**
   * Sign in with GitHub OAuth
   * @returns {Promise<{url: string, sessionId: string, message: string}>}
   * @throws {Error}
   */
  async signInWithGitHub() {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
    }

    try {
      // Open the website authentication page which will handle GitHub OAuth
      const vscode = require('vscode')
      const config = vscode.workspace.getConfiguration('pasteportal')
      const domain = config.get('domain', 'https://pasteportal.app')
      
      // Open website authentication page
      await vscode.env.openExternal(vscode.Uri.parse(`${domain}/auth/vscode?mode=signin`))

      return {
        url: `${domain}/auth/vscode?mode=signin`,
        message: 'Opening website for authentication. Use GitHub sign in on the website, and you will be redirected to VS Code automatically.'
      }
    } catch (error) {
      console.error('GitHub sign in error:', error.message)
      throw error
    }
  }

  /**
   * Get Supabase client instance
   * @returns {Object|null}
   */
  getSupabaseClient() {
    return this.supabaseClient
  }

  /**
   * Public method to save session (for URI handler)
   * @param {Object} session - Supabase session object
   */
  async saveSession(session) {
    return await this._saveSession(session)
  }
}

module.exports = Auth

