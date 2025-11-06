const vscode = require('vscode')
const axios = require('axios')
const crypto = require('crypto')
const OperationsTreeProvider = require('./lib/operations-tree-provider')
const SecureStorage = require('./lib/secure-storage')
const Auth = require('./lib/auth')
const ApiClient = require('./lib/api-client')
const AuthTreeProvider = require('./lib/views/auth-tree-provider')

const tos_link =
  '[Terms of Service](https://github.com/stiliajohny/pasteportal/blob/master/vscode-extension/TOS.md)'
const passwordLengthMin = 8
const passwordLengthMax = 30

// Status bar item for API connectivity
let statusBarItem = null
let connectivityCheckInterval = null
const MIN_CHECK_INTERVAL = 60000 // Minimum 60 seconds

// Operations tree provider
let operationsTreeProvider = null

// Auth system
let secureStorage = null
let auth = null
let apiClient = null
let authTreeProvider = null

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password against requirements
 * @param {string} password - Password to validate
 * @returns {{isValid: boolean, errors: string[]}} Validation result with errors
 */
function validatePassword(password) {
  const errors = []

  if (password.length < passwordLengthMin) {
    errors.push('Password must be at least 8 characters long')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one symbol')
  }

  if (password.length > passwordLengthMax) {
    errors.push(`Password must be less than ${passwordLengthMax} characters long`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get API endpoint from VS Code configuration
 * Uses serverUrl if apiEndpoint is not explicitly set
 * @returns {string}
 */
function getApiEndpoint() {
  const config = vscode.workspace.getConfiguration('pasteportal')
  
  // Check if apiEndpoint is explicitly configured (not using default)
  const apiEndpointInspect = config.inspect('apiEndpoint')
  const isApiEndpointExplicit = apiEndpointInspect && (
    apiEndpointInspect.globalValue !== undefined ||
    apiEndpointInspect.workspaceValue !== undefined ||
    apiEndpointInspect.workspaceFolderValue !== undefined
  )
  
  if (isApiEndpointExplicit) {
    return config.get('apiEndpoint', 'https://pasteportal.app/api')
  }
  
  // Otherwise, derive from serverUrl
  const serverUrl = config.get('serverUrl', 'http://localhost:3000')
  // Ensure serverUrl doesn't end with /api
  const baseUrl = serverUrl.replace(/\/api$/, '')
  return `${baseUrl}/api`
}

/**
 * Get domain URL from VS Code configuration
 * Uses serverUrl if domain is not explicitly set
 * @returns {string}
 */
function getDomain() {
  const config = vscode.workspace.getConfiguration('pasteportal')
  
  // Check if domain is explicitly configured (not using default)
  const domainInspect = config.inspect('domain')
  const isDomainExplicit = domainInspect && (
    domainInspect.globalValue !== undefined ||
    domainInspect.workspaceValue !== undefined ||
    domainInspect.workspaceFolderValue !== undefined
  )
  
  if (isDomainExplicit) {
    return config.get('domain', 'https://pasteportal.app')
  }
  
  // Otherwise, use serverUrl
  return config.get('serverUrl', 'http://localhost:3000')
}

/**
 * Get health check URL from API endpoint
 * @returns {string}
 */
function getHealthCheckUrl() {
  const apiEndpoint = getApiEndpoint()
  // Use OpenAPI spec endpoint as a lightweight health check
  // Handle different API endpoint formats
  if (apiEndpoint.endsWith('/api')) {
    return apiEndpoint + '/openapi-spec'
  } else if (apiEndpoint.endsWith('/api/')) {
    return apiEndpoint + 'openapi-spec'
  } else {
    // Fallback: try to construct from base URL
    const baseUrl = apiEndpoint.replace(/\/api.*$/, '')
    return baseUrl + '/api/openapi-spec'
  }
}

/**
 * Check API connectivity by making a lightweight request
 * @returns {Promise<boolean>}
 */
async function checkApiConnectivity() {
  try {
    const healthCheckUrl = getHealthCheckUrl()
    
    // Make a HEAD request with short timeout for quick check
    await axios.head(healthCheckUrl, {
      timeout: 3000, // 3 second timeout
      validateStatus: (status) => status < 500, // Accept any status below 500 as "server is reachable"
      decompress: false,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
    return true
  } catch (error) {
    // If HEAD fails, try GET as fallback
    try {
      const healthCheckUrl = getHealthCheckUrl()
      await axios.get(healthCheckUrl, {
        timeout: 3000,
        validateStatus: (status) => status < 500,
        decompress: false,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      return true
    } catch (fallbackError) {
      console.log('API connectivity check failed:', fallbackError.message)
      return false
    }
  }
}

/**
 * Update the status bar item with current connectivity status
 * @param {boolean} isConnected - Whether the API is reachable
 */
function updateStatusBar(isConnected) {
  if (!statusBarItem) {
    return
  }

  if (isConnected) {
    statusBarItem.text = '$(plug) PastePortal'
    statusBarItem.tooltip = 'Connected to PastePortal API'
    statusBarItem.backgroundColor = undefined // Use default (no custom background)
  } else {
    statusBarItem.text = '$(error) PastePortal'
    statusBarItem.tooltip = 'Cannot connect to PastePortal API. Check your connection or API endpoint settings.'
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
  }
  
  statusBarItem.show()
}

/**
 * Check API connectivity and update status bar
 * Shows a checking state while verifying connectivity
 */
async function checkAndUpdateStatus() {
  if (!statusBarItem) {
    return
  }

  // Show checking state
  statusBarItem.text = '$(sync~spin) PastePortal'
  statusBarItem.tooltip = 'Checking API connectivity...'
  statusBarItem.show()

  // Check connectivity
  const isConnected = await checkApiConnectivity()
  updateStatusBar(isConnected)
}

/**
 * Get connectivity check enabled setting
 * @returns {boolean}
 */
function isConnectivityCheckEnabled() {
  const config = vscode.workspace.getConfiguration('pasteportal')
  return config.get('statusBar.enableConnectivityCheck', true)
}

/**
 * Get connectivity check interval setting
 * @returns {number} - Interval in milliseconds (minimum 60 seconds)
 */
function getConnectivityCheckInterval() {
  const config = vscode.workspace.getConfiguration('pasteportal')
  const intervalSeconds = config.get('statusBar.connectivityCheckInterval', 60)
  // Ensure minimum interval of 60 seconds
  const intervalMs = Math.max(intervalSeconds * 1000, MIN_CHECK_INTERVAL)
  return intervalMs
}

/**
 * Initialize status bar item for API connectivity
 * @param {vscode.ExtensionContext} context - Extension context for subscriptions
 */
function initializeStatusBar(context) {
  // Check if connectivity check is enabled
  if (!isConnectivityCheckEnabled()) {
    console.log('Status bar connectivity check is disabled')
    return
  }

  // Create status bar item on the right side with priority 100 (higher = more right)
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  
  // Add status bar item to subscriptions for proper cleanup
  context.subscriptions.push(statusBarItem)
  
  // Initial status check
  checkAndUpdateStatus()
  
  // Set up periodic connectivity checks with configured interval
  const checkInterval = getConnectivityCheckInterval()
  connectivityCheckInterval = setInterval(() => {
    checkAndUpdateStatus()
  }, checkInterval)

  // Create a disposable for the interval to ensure proper cleanup
  const intervalDisposable = {
    dispose: () => {
      if (connectivityCheckInterval) {
        clearInterval(connectivityCheckInterval)
        connectivityCheckInterval = null
      }
    }
  }
  context.subscriptions.push(intervalDisposable)

  // Also check when configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pasteportal.apiEndpoint') || e.affectsConfiguration('pasteportal.serverUrl')) {
      checkAndUpdateStatus()
    } else if (e.affectsConfiguration('pasteportal.statusBar.enableConnectivityCheck')) {
      // If setting changed, reinitialize the status bar
      if (connectivityCheckInterval) {
        clearInterval(connectivityCheckInterval)
        connectivityCheckInterval = null
      }
      if (statusBarItem) {
        statusBarItem.hide()
        statusBarItem.dispose()
        statusBarItem = null
      }
      initializeStatusBar(context)
    } else if (e.affectsConfiguration('pasteportal.statusBar.connectivityCheckInterval')) {
      // Restart interval with new frequency
      if (connectivityCheckInterval) {
        clearInterval(connectivityCheckInterval)
      }
      const newInterval = getConnectivityCheckInterval()
      connectivityCheckInterval = setInterval(() => {
        checkAndUpdateStatus()
      }, newInterval)
    }
  })
  
  // Add config change listener to subscriptions
  context.subscriptions.push(configChangeDisposable)
}

/**
 * Generate a random password
 * @param {number} length - Length of the password (default: 16)
 * @returns {string} Random password string
 */
function generateRandomPassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const randomValues = crypto.randomBytes(length)
  
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length]
  }
  
  return password
}

/**
 * Validate password according to requirements
 * @param {string} password
 * @throws {TypeError}
 * @throws {Error}
 */
function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string')
  }
  if (!password) {
    throw new Error('No password provided')
  }
  if (password.length < passwordLengthMin) {
    throw new Error(`Password should be at least ${passwordLengthMin} characters long.`)
  }
  if (password.length > passwordLengthMax) {
    throw new Error(`Password should be less than ${passwordLengthMax} characters long.`)
  }
  if (/[\s\t\n\r\v\f\0]/.test(password)) {
    throw new Error('Password should not contain whitespace characters (spaces, tabs, newlines, etc.).')
  }
}

/**
 * Derive a key from a password using PBKDF2 (matching web UI implementation)
 * @param {string} password - Password to derive key from
 * @param {Buffer} salt - Salt bytes for key derivation
 * @returns {Buffer} Derived key (32 bytes for AES-256)
 */
function deriveKeyFromPassword(password, salt) {
  // Use PBKDF2 with same parameters as web UI: 100000 iterations, SHA-256
  // This ensures compatibility between VS Code extension and web UI
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
}

/**
 * Encrypt the text using the password
 * Uses new format with random salt (format version "01")
 * Format: "01" + salt (32 hex chars) + IV (32 hex chars) + encrypted data
 * Uses PBKDF2 for key derivation to match web UI implementation
 * @param {string} password
 * @param {string} text
 * @returns {string}
 * @throws {TypeError}
 * @throws {Error}
 */
function encrypt(password, text) {
  try {
    validatePassword(password)
    if (typeof text !== 'string') {
      throw new TypeError('Text must be a string')
    }
    if (!text) {
      throw new Error('Text cannot be empty')
    }

    const algorithm = 'aes-256-cbc'
    // Generate random salt (16 bytes = 32 hex chars) for new format
    const salt = crypto.randomBytes(16)
    // Generate random IV
    const iv = crypto.randomBytes(16)
    // Derive key from password using PBKDF2 (matching web UI)
    const key = deriveKeyFromPassword(password, salt)
    
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // New format: version marker "01" + salt + IV + encrypted data
    const saltHex = salt.toString('hex')
    const ivHex = iv.toString('hex')
    return '01' + saltHex + ivHex + encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    throw error
  }
}

/**
 * Decrypt the text using the password
 * Supports both new format (with version marker "01" and random salt) and legacy format (static salt)
 * New format: "01" + salt (32 hex) + IV (32 hex) + encrypted data
 * Legacy format: IV (32 hex) + encrypted data (no version marker, uses static salt)
 * @param {string} password
 * @param {string} encryptedText
 * @returns {string}
 * @throws {TypeError}
 * @throws {Error}
 */
function decrypt(password, encryptedText) {
  try {
    validatePassword(password)
    if (typeof encryptedText !== 'string') {
      throw new TypeError('Encrypted text must be a string')
    }
    if (!encryptedText) {
      throw new Error('Encrypted text cannot be empty')
    }

    const algorithm = 'aes-256-cbc'
    let salt
    let ivHex
    let encryptedHex

    // Check for new format: starts with version marker "01"
    if (encryptedText.length > 66 && encryptedText.startsWith('01')) {
      // New format: "01" + salt (32 hex) + IV (32 hex) + encrypted data
      const saltHex = encryptedText.slice(2, 34) // 2-33 (32 chars)
      ivHex = encryptedText.slice(34, 66) // 34-65 (32 chars)
      encryptedHex = encryptedText.slice(66) // rest
      
      // Convert salt hex to Buffer
      salt = Buffer.from(saltHex, 'hex')
    } else {
      // Legacy format: IV (32 hex) + encrypted data (no version marker, no salt)
      ivHex = encryptedText.slice(0, 32)
      encryptedHex = encryptedText.slice(32)
      // salt remains undefined, will use legacy static salt "salt"
      salt = Buffer.from('salt', 'utf8')
    }

    // Convert hex to Buffer
    const iv = Buffer.from(ivHex, 'hex')
    
    // Derive key from password using PBKDF2 (matching web UI)
    // Use provided salt or legacy static salt for backward compatibility
    const key = deriveKeyFromPassword(password, salt)
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw error
  }
}

/**
 * Get the paste id from the text
 * Supports both UUID v4 format and legacy 6-character hex format
 * @param {string} text
 * @returns {string|null}
 *
 * @example
 * getPasteId('https://pasteportal.app/?id=abc123') // returns 'abc123'
 * getPasteId('abc123') // returns 'abc123'
 * getPasteId('550e8400-e29b-41d4-a716-446655440000') // returns '550e8400-e29b-41d4-a716-446655440000'
 * getPasteId('https://pasteportal.app/?id=550e8400-e29b-41d4-a716-446655440000') // returns '550e8400-e29b-41d4-a716-446655440000'
 */
function getPasteId(text) {
  try {
    if (typeof text !== 'string' || !text) {
      return null
    }

    // UUID v4 regex: 8-4-4-4-12 hex digits with hyphens
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    // Legacy 6-character hex format
    const legacyHexRegex = /^[a-fA-F0-9]{6}$/
    // URL format with pasteportal domain (supports both .info and .app)
    const urlRegex = /^(?:http:\/\/|https:\/\/)pasteportal\.(?:info|app)\/?\?id=([a-fA-F0-9-]+)$/i

    // Try URL format first
    const urlMatch = text.match(urlRegex)
    if (urlMatch) {
      return urlMatch[1]
    }

    // Check if it's a direct UUID v4
    if (uuidRegex.test(text)) {
      return text
    }

    // Check if it's a legacy 6-char hex
    if (legacyHexRegex.test(text)) {
      return text
    }

    return null
  } catch (error) {
    console.error('Error parsing paste ID:', error)
    return null
  }
}

/**
 * Create a multiline string to be copied to clipboard
 * @param {string} id
 * @param {string} [password] Optional password for encrypted pastes
 * @returns {string}
 * @throws {TypeError}
 * @throws {Error}
 */
function multiLineClipboard(id, password) {
  try {
    if (typeof id !== 'string') {
      throw new TypeError('ID must be a string')
    }
    if (id.length < 1) {
      throw new Error('ID cannot be empty')
    }

    const domain = getDomain()
    const url = `${domain}/?id=${id}`

    if (password) {
      if (typeof password !== 'string') {
        throw new TypeError('Password must be a string')
      }
      if (password.length < passwordLengthMin) {
        throw new Error('Password cannot be empty')
      }
      const clipText = `To get the paste, go to ${url} and enter the password ${password}\nYou can also use the VSCode command "PastePortal: Retrieve Encrypted Paste" to get the paste.\nUse the URL ${url} and password ${password} to get the paste.`
      return clipText
    } else {
      const clipText = `To get the paste, go to ${url}\nYou can also use the VSCode command "PastePortal: Retrieve Paste" to get the paste.\nUse the URL ${url} to get the paste.`
      return clipText
    }
  } catch (error) {
    console.error('Error creating clipboard text:', error)
    throw error
  }
}

async function checkServiceAgreement() {
  /**
   * Check if the user has accepted the service agreement or not
   * If the user has not accepted the service agreement, ask the user to accept the terms of service
   * If the user has accepted the service agreement, return true
   * If the user has not accepted the service agreement, return false
   *
   * @returns {boolean}
   */
  const serviceAgreementAccepted = vscode.workspace
    .getConfiguration()
    .get('pasteportal.serviceAgreementAccepted')
  if (serviceAgreementAccepted === true) {
    console.log('Service agreement accepted already')
    return true
  } else if (serviceAgreementAccepted === false) {
    console.log(
      'Service agreement was not accepted. Asking user to accept the terms of service'
    )

    const acceptTerms = await vscode.window.showInformationMessage(
      `Please accept the ${tos_link} before using the extension.`,
      'Agree',
      'Disagree'
    )
    if (acceptTerms === 'Agree') {
      vscode.workspace
        .getConfiguration()
        .update(
          'pasteportal.serviceAgreementAccepted',
          true,
          vscode.ConfigurationTarget.Global
        )
      console.log('Service agreement accepted')
      return true
    } else if (acceptTerms === 'Disagree') {
      vscode.workspace
        .getConfiguration()
        .update(
          'pasteportal.serviceAgreementAccepted',
          false,
          vscode.ConfigurationTarget.Global
        )
      vscode.window.showErrorMessage(
        'You must accept the terms of service to use this extension.'
      )
      console.log('Service agreement not accepted')
      return false
    }
  }
}

/**
 * Handle email/password sign in
 */
async function handleEmailSignIn() {
  try {
    if (!auth || !auth.isConfigured()) {
      vscode.window.showErrorMessage('Authentication is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
      return
    }

    // Open website for authentication
    const domain = getDomain()
    await vscode.env.openExternal(vscode.Uri.parse(`${domain}/auth/vscode?mode=signin`))
    
    vscode.window.showInformationMessage(
      'Opening website for authentication. After signing in, you will be redirected back to VS Code automatically.'
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Handle email/password sign up
 */
async function handleEmailSignUp() {
  try {
    if (!auth || !auth.isConfigured()) {
      vscode.window.showErrorMessage('Authentication is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
      return
    }

    // Open website for authentication
    const domain = getDomain()
    await vscode.env.openExternal(vscode.Uri.parse(`${domain}/auth/vscode?mode=signup`))
    
    vscode.window.showInformationMessage(
      'Opening website for authentication. After signing up, you will be redirected back to VS Code automatically.'
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Handle magic link sign in
 */
async function handleMagicLinkSignIn() {
  try {
    if (!auth || !auth.isConfigured()) {
      vscode.window.showErrorMessage('Authentication is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
      return
    }

    // Open website for authentication
    const domain = getDomain()
    await vscode.env.openExternal(vscode.Uri.parse(`${domain}/auth/vscode?mode=signin`))
    
    vscode.window.showInformationMessage(
      'Opening website for authentication. Use the magic link option on the website to sign in.'
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Handle OTP sign in (two-step: request code, then verify)
 */
async function handleOTPSignIn() {
  try {
    if (!auth || !auth.isConfigured()) {
      vscode.window.showErrorMessage('Authentication is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
      return
    }

    // Open website for authentication
    const domain = getDomain()
    await vscode.env.openExternal(vscode.Uri.parse(`${domain}/auth/vscode?mode=signin`))
    
    vscode.window.showInformationMessage(
      'Opening website for authentication. Use the OTP option on the website to sign in.'
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Handle GitHub OAuth sign in
 */
async function handleGitHubSignIn() {
  try {
    if (!auth || !auth.isConfigured()) {
      vscode.window.showErrorMessage('Authentication is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
      return
    }

    // For signup, require terms acceptance
    const isSignUp = await vscode.window.showQuickPick(
      ['Sign In', 'Sign Up'],
      { placeHolder: 'Are you signing in or signing up?' }
    )

    if (!isSignUp) return

    const mode = isSignUp === 'Sign Up' ? 'signup' : 'signin'

    if (mode === 'signup') {
      const acceptTerms = await vscode.window.showInformationMessage(
        'Do you accept the Terms of Service and Privacy Policy?',
        { modal: true },
        'Accept',
        'View Terms'
      )

      if (acceptTerms === 'View Terms') {
        await vscode.env.openExternal(vscode.Uri.parse('https://pasteportal.app/terms'))
        return
      }

      if (acceptTerms !== 'Accept') {
        return
      }
    }

    // Open website for authentication
    const domain = getDomain()
    await vscode.env.openExternal(vscode.Uri.parse(`${domain}/auth/vscode?mode=${mode}`))
    
    vscode.window.showInformationMessage(
      'Opening website for authentication. Use GitHub sign in on the website, and you will be redirected to VS Code automatically.'
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Handle password reset
 */
async function handlePasswordReset() {
  try {
    if (!auth || !auth.isConfigured()) {
      vscode.window.showErrorMessage('Authentication is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
      return
    }

    const email = await vscode.window.showInputBox({
      prompt: 'Enter your email',
      placeHolder: 'your@email.com',
      validateInput: (value) => {
        if (!value || !validateEmail(value)) {
          return 'Please enter a valid email address'
        }
        return null
      }
    })

    if (!email) return

    vscode.window.showInformationMessage(
      'Please use the website to reset your password: https://pasteportal.app/auth/reset-password'
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Handle sign out
 */
async function handleSignOut() {
  try {
    if (!auth) {
      return
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Signing out...',
      cancellable: false
    }, async () => {
      try {
        await auth.signOut()
        vscode.window.showInformationMessage('Signed out successfully')
        
        // Clear pastes in tree view
        if (authTreeProvider) {
          authTreeProvider.clearPastes()
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Sign out failed: ${error.message}`)
      }
    })
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Handle refresh pastes
 */
async function handleRefreshPastes() {
  try {
    if (!authTreeProvider) {
      return
    }

    const isAuthenticated = await auth.isAuthenticated()
    if (!isAuthenticated) {
      vscode.window.showWarningMessage('Please sign in to view your pastes')
      return
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Refreshing pastes...',
      cancellable: false
    }, async () => {
      await authTreeProvider.loadPastes()
    })
  } catch (error) {
    vscode.window.showErrorMessage(`Error refreshing pastes: ${error.message}`)
  }
}

/**
 * Handle manual token sign in (for magic link workaround)
 */
async function handleSignInWithToken() {
  try {
    if (!auth || !auth.isConfigured()) {
      vscode.window.showErrorMessage('Authentication is not configured. Please set pasteportal.supabase.url and pasteportal.supabase.anonKey in settings.')
      return
    }

    // Option 1: Paste full URL
    const urlOption = await vscode.window.showQuickPick(
      [
        { label: 'Paste full URL from browser', value: 'url' },
        { label: 'Enter access_token and refresh_token manually', value: 'tokens' }
      ],
      { placeHolder: 'How do you want to sign in?' }
    )

    if (!urlOption) return

    if (urlOption.value === 'url') {
      const urlInput = await vscode.window.showInputBox({
        prompt: 'Paste the full URL from your browser (localhost:3000/#access_token=...)',
        placeHolder: 'http://localhost:3000/#access_token=...',
        validateInput: (value) => {
          if (!value || (!value.includes('access_token=') && !value.includes('access_token%3D'))) {
            return 'URL must contain access_token parameter'
          }
          return null
        }
      })

      if (!urlInput) return

      // Parse URL to extract tokens
      try {
        const url = new URL(urlInput)
        const hash = url.hash.substring(1) // Remove #
        const params = new URLSearchParams(hash)
        
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const expiresAt = params.get('expires_at')
        const expiresIn = params.get('expires_in')

        if (!accessToken) {
          throw new Error('access_token not found in URL')
        }

        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Signing in...',
          cancellable: false
        }, async () => {
          await completeTokenSignIn(accessToken, refreshToken, expiresAt, expiresIn)
        })
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to parse URL: ${error.message}. Please check the URL format.`)
      }
    } else {
      // Option 2: Manual token entry
      const accessToken = await vscode.window.showInputBox({
        prompt: 'Enter access_token from the URL',
        password: false,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Access token is required'
          }
          return null
        }
      })

      if (!accessToken) return

      const refreshToken = await vscode.window.showInputBox({
        prompt: 'Enter refresh_token from the URL (optional, but recommended)',
        password: false
      })

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Signing in...',
        cancellable: false
      }, async () => {
        await completeTokenSignIn(accessToken.trim(), refreshToken?.trim() || null, null, null)
      })
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

/**
 * Complete sign in using tokens
 */
async function completeTokenSignIn(accessToken, refreshToken, expiresAt = null, expiresIn = null) {
  try {
    const supabaseClient = auth.getSupabaseClient()
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized')
    }

    // Use setSession with tokens - this is the proper way
    if (refreshToken) {
      const { data, error: sessionError } = await supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })

      if (sessionError) {
        throw sessionError
      }

      if (data.session) {
        await auth.saveSession(data.session)
        
        // Verify session is saved before proceeding
        const sessionSaved = await auth.isAuthenticated()
        if (!sessionSaved) {
          throw new Error('Failed to save session')
        }
        
        vscode.window.showInformationMessage('Signed in successfully!')
        
        // Refresh auth tree view to show authenticated state
        if (authTreeProvider) {
          authTreeProvider.refresh()
          // Load pastes after session is confirmed saved
          await authTreeProvider.loadPastes()
        }
        return
      }
    } else {
      // If only access token (no refresh token), we can still create a session
      // but it will expire when the access token expires
      // Create a minimal session object
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(accessToken)
      
      if (userError) {
        throw new Error('Invalid access token. Please make sure you copied the complete token from the URL.')
      }

      // Extract expires_at from parameter or calculate from expires_in, or use default (1 hour from now)
      let expiresAtTimestamp = expiresAt ? parseInt(expiresAt) : null
      if (!expiresAtTimestamp && expiresIn) {
        expiresAtTimestamp = Math.floor(Date.now() / 1000) + parseInt(expiresIn)
      }
      if (!expiresAtTimestamp) {
        expiresAtTimestamp = Math.floor(Date.now() / 1000) + 3600 // Default 1 hour
      }
      
      // Create a session-like object
      const sessionData = {
        access_token: accessToken,
        refresh_token: null, // No refresh token
        expires_at: expiresAtTimestamp,
        expires_in: expiresIn ? parseInt(expiresIn) : 3600,
        token_type: 'bearer',
        user: user
      }

      // Save the session
      await auth.saveSession(sessionData)
      
      // Verify session is saved before proceeding
      const sessionSaved = await auth.isAuthenticated()
      if (!sessionSaved) {
        throw new Error('Failed to save session')
      }
      
      vscode.window.showWarningMessage('Signed in with access token only. Session will expire in 1 hour. For persistent sessions, include the refresh_token.')
      
      // Refresh auth tree view to show authenticated state
      if (authTreeProvider) {
        authTreeProvider.refresh()
        // Load pastes after session is confirmed saved
        await authTreeProvider.loadPastes()
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Sign in failed: ${error.message}`)
    throw error
  }
}

/**
 * Handle view paste from tree view
 */
async function handleViewPaste(pasteId) {
  try {
    if (!pasteId) {
      vscode.window.showErrorMessage('No paste ID provided')
      return
    }

    // Execute the get-paste command with the paste ID
    // First prompt for password if it's encrypted
    const pasteIdStr = typeof pasteId === 'string' ? pasteId : (pasteId.id || pasteId.pasteId)
    
    if (!pasteIdStr) {
      vscode.window.showErrorMessage('Invalid paste ID')
      return
    }

    // Get the paste first to check if it's encrypted
    try {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showErrorMessage('No active text editor.')
        return
      }

      const apiEndpoint = getApiEndpoint()
      const baseURL = `${apiEndpoint}/get-paste?id=${pasteIdStr}`
      
      const response = await axios.get(baseURL, {
        decompress: false,
        responseType: 'json',
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      const responseData = response.data
      if (!responseData || !responseData.response) {
        throw new Error('Invalid response format from server')
      }

      const { paste, is_password_encrypted } = responseData.response

      if (is_password_encrypted) {
        // Ask for password
        const password = await vscode.window.showInputBox({
          prompt: 'Enter the password to decrypt the paste',
          password: true
        })

        if (!password) {
          return
        }

        // Use get-encrypted-paste flow
        try {
          const decryptedText = decrypt(password, paste)
          await editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, decryptedText)
          })
          vscode.window.showInformationMessage('Encrypted paste retrieved and decrypted successfully.')
        } catch (decryptError) {
          vscode.window.showErrorMessage(`Decryption failed: ${decryptError.message}`)
        }
      } else {
        // Insert plain text paste
        await editor.edit((editBuilder) => {
          editBuilder.insert(editor.selection.active, paste)
        })
        vscode.window.showInformationMessage('Paste retrieved successfully.')
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to retrieve paste: ${error.message}`)
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`)
  }
}

function activate(context) {
  /**
   * This method is called when your extension is activated.
   * Your extension is activated the very first time the command is executed.
   *
   * @param {vscode.ExtensionContext} context
   *
   */
  console.log('Congratulations, your extension "pasteportal" is now active!')

  // Initialize status bar for API connectivity
  initializeStatusBar(context)

  // Initialize auth system
  try {
    secureStorage = new SecureStorage(context.secrets)
    auth = new Auth(secureStorage)
    apiClient = new ApiClient(auth)
    authTreeProvider = new AuthTreeProvider(auth, apiClient)
    
    // Register "My Pastes" tree view
    const authTreeView = vscode.window.createTreeView('pasteportal-my-pastes', {
      treeDataProvider: authTreeProvider
    })
    context.subscriptions.push(authTreeView)

    // Refresh tree view after initialization
    authTreeProvider.refresh()

    // Load pastes if user is already authenticated
    ;(async () => {
      try {
        const isAuthenticated = await auth.isAuthenticated()
        if (isAuthenticated) {
          await authTreeProvider.loadPastes()
        }
      } catch (error) {
        // Non-critical error - just log it
        console.log('Failed to load pastes on startup:', error.message)
      }
    })()

    // Register URI handler for OAuth/magic link callbacks
    const uriHandler = vscode.window.registerUriHandler({
      handleUri: async (uri) => {
        console.log('Received URI:', uri.toString())
        
        // The URI will be like: vscode://JohnStilia.pasteportal/auth-callback?code=abc123&session_id=xyz
        if (uri.path === '/auth-callback') {
          const queryParams = new URLSearchParams(uri.query)
          const code = queryParams.get('code')
          const accessToken = queryParams.get('access_token')
          const refreshToken = queryParams.get('refresh_token')
          const error = queryParams.get('error')
          const errorDescription = queryParams.get('error_description')

          if (error) {
            vscode.window.showErrorMessage(`Authentication failed: ${errorDescription || error}`)
            return
          }

          // Handle Supabase OAuth callback
          if (code && auth) {
            try {
              await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Completing authentication...',
                cancellable: false
              }, async () => {
                // Exchange code for session
                const supabaseClient = auth.getSupabaseClient()
                if (supabaseClient) {
                  const { data, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code)
                  
                  if (exchangeError) {
                    throw exchangeError
                  }

                  if (data.session) {
                    // Save session using auth helper
                    await auth.saveSession(data.session)
                    
                    // Verify session is saved before proceeding
                    const sessionSaved = await auth.isAuthenticated()
                    if (!sessionSaved) {
                      throw new Error('Failed to save session')
                    }
                    
                    vscode.window.showInformationMessage('Authentication successful!')
                    
                    // Refresh auth tree view to show authenticated state
                    if (authTreeProvider) {
                      authTreeProvider.refresh()
                      // Load pastes after session is confirmed saved
                      await authTreeProvider.loadPastes()
                    }
                  }
                }
              })
            } catch (error) {
              vscode.window.showErrorMessage(`Authentication error: ${error.message}`)
            }
          } else if (accessToken && refreshToken && auth) {
            // Direct token callback (if Supabase sends tokens directly)
            try {
              const supabaseClient = auth.getSupabaseClient()
              if (supabaseClient) {
                const { data, error: sessionError } = await supabaseClient.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                })

                if (sessionError) {
                  throw sessionError
                }

                if (data.session) {
                  await auth.saveSession(data.session)
                  
                  // Verify session is saved before proceeding
                  const sessionSaved = await auth.isAuthenticated()
                  if (!sessionSaved) {
                    throw new Error('Failed to save session')
                  }
                  
                  vscode.window.showInformationMessage('Authentication successful!')
                  
                  // Refresh auth tree view to show authenticated state
                  if (authTreeProvider) {
                    authTreeProvider.refresh()
                    // Load pastes after session is confirmed saved
                    await authTreeProvider.loadPastes()
                  }
                }
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Authentication error: ${error.message}`)
            }
          }
        }
      }
    })

    context.subscriptions.push(uriHandler)

    // Register authentication commands
    const signInCommand = vscode.commands.registerCommand('pasteportal.sign-in', handleEmailSignIn)
    const signUpCommand = vscode.commands.registerCommand('pasteportal.sign-up', handleEmailSignUp)
    const magicLinkCommand = vscode.commands.registerCommand('pasteportal.sign-in-magic-link', handleMagicLinkSignIn)
    const otpCommand = vscode.commands.registerCommand('pasteportal.sign-in-otp', handleOTPSignIn)
    const githubCommand = vscode.commands.registerCommand('pasteportal.sign-in-github', handleGitHubSignIn)
    const resetPasswordCommand = vscode.commands.registerCommand('pasteportal.reset-password', handlePasswordReset)
    const signOutCommand = vscode.commands.registerCommand('pasteportal.sign-out', handleSignOut)
    const refreshPastesCommand = vscode.commands.registerCommand('pasteportal.refresh-pastes', handleRefreshPastes)
    const viewPasteCommand = vscode.commands.registerCommand('pasteportal.view-paste', handleViewPaste)
    const signInWithTokenCommand = vscode.commands.registerCommand('pasteportal.sign-in-with-token', handleSignInWithToken)

    context.subscriptions.push(
      signInCommand,
      signUpCommand,
      magicLinkCommand,
      otpCommand,
      githubCommand,
      resetPasswordCommand,
      signOutCommand,
      refreshPastesCommand,
      viewPasteCommand,
      signInWithTokenCommand
    )
  } catch (error) {
    console.error('Error initializing auth system:', error)
    vscode.window.showErrorMessage(`Failed to initialize authentication: ${error.message}`)
  }

  // Initialize operations tree provider
  operationsTreeProvider = new OperationsTreeProvider()
  context.subscriptions.push(
    vscode.window.createTreeView('pasteportal-operations', {
      treeDataProvider: operationsTreeProvider
    })
  )

  // Listen for API endpoint configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pasteportal.apiEndpoint') || e.affectsConfiguration('pasteportal.serverUrl')) {
      // Refresh status bar on endpoint change
      checkAndUpdateStatus()
    }
  })
  context.subscriptions.push(configChangeDisposable)

  // Register basic paste commands (no auth required)
  const get_paste = vscode.commands.registerCommand(
    'pasteportal.get-paste',
    async function () {
      /**
       * Get the paste from the API and insert it into the active editor
       * @returns {void}
       * @throws {Error}
       * @throws {AxiosError}
       * @throws {vscode.window.showErrorMessage}
       * @throws {vscode.window.showInformationMessage}
       * @throws {vscode.window.showInputBox}
       */
      try {
        // check if user has accepted the service agreement or not
        if (!(await checkServiceAgreement())) {
          return
        }

        console.log('Command: pasteportal.get-paste - started')
        // get the active text editor
        const editor = vscode.window.activeTextEditor
        // check if there is an active text editor
        if (!editor) throw new Error('No active text editor.')
        console.log('Active text editor found')

        const prompt = await vscode.window.showInputBox({
          prompt: 'Enter the paste ID or URL (e.g., abc123 or https://pasteportal.app/?id=abc123)'
        })
        console.log('Prompt: ', prompt)

        if (!prompt) {
          vscode.window.showErrorMessage('Paste ID/URL is required')
          return
        }

        // get the paste ID from the user
        const pasteId = getPasteId(prompt)
        console.log('Paste ID: ', pasteId)

        if (!pasteId) {
          vscode.window.showErrorMessage('Invalid paste ID or URL format. Please provide a valid ID (6-character hex or UUID) or URL.')
          return
        }

        const apiEndpoint = getApiEndpoint()
        const baseURL = `${apiEndpoint}/get-paste?id=${pasteId}`
        try {
          const response = await axios.get(baseURL, {
            decompress: false,
            responseType: 'json',
            timeout: 10000,
            headers: {
              'Accept': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
          const responseData = response.data

          if (!responseData || !responseData.response) {
            throw new Error('Invalid response format from server')
          }

          const { paste, id, message, joke, is_password_encrypted } = responseData.response
          
          if (!paste) {
            throw new Error('Paste content not found in response')
          }

          console.log('Paste retrieved - ID:', id)
          console.log('Is password encrypted:', is_password_encrypted)

          // Update status bar to reflect successful connection
          updateStatusBar(true)

          // insert the paste content into the active editor
          await editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, paste)
          })
          
          vscode.window.showInformationMessage('Paste retrieved successfully.')
        } catch (error) {
          console.error('Error retrieving paste:', error)
          
          let errorMessage = 'Failed to retrieve paste'
          if (error.response) {
            // Server responded with error status
            const status = error.response.status
            const errorData = error.response.data
            const serverMessage = (errorData && errorData.response && errorData.response.message) || error.message
            
            if (status === 400) {
              errorMessage = `Invalid paste ID or paste not found: ${serverMessage}`
            } else if (status === 404) {
              errorMessage = 'Paste not found. Please check the ID and try again.'
            } else if (status >= 500) {
              errorMessage = 'Server error. Please try again later.'
            } else {
              errorMessage = serverMessage
            }
          } else if (error.request) {
            errorMessage = 'Network error. Please check your internet connection.'
            // Update status bar to reflect connection failure
            updateStatusBar(false)
          } else {
            errorMessage = error.message || 'An unexpected error occurred'
          }
          
          vscode.window.showErrorMessage(`Failed to retrieve paste: ${errorMessage}`)
        }
      } catch (error) {
        console.error('Error in get-paste command:', error)
        const errorMessage = error.message || 'An unexpected error occurred'
        vscode.window.showErrorMessage(`Failed to retrieve paste: ${errorMessage}`)
      }
    }
  )

  const store_paste = vscode.commands.registerCommand(
    'pasteportal.store-paste',
    async function () {
      /**
       * Store the paste in the API
       * @returns {void}
       * @throws {Error}
       * @throws {AxiosError}
       * @throws {vscode.window.showErrorMessage}
       * @throws {vscode.window.showInformationMessage}
       * @throws {vscode.window.showInputBox}
       */
      try {
        // check if user has accepted the service agreement or not
        if (!(await checkServiceAgreement())) {
          return
        }
        console.log('Command: pasteportal.store-paste - started')
        // get the active text editor
        const editor = vscode.window.activeTextEditor
        //  check if there is an active text editor and if there isnt thwor an error using the catch
        if (!editor) throw new Error('No active text editor.')
        console.log('Active text editor found')
        // Get the selected text
        const selectedText = editor.document.getText(editor.selection)
        if (!selectedText) throw new Error('No text selected.')
        console.log('Selected text found')

        // check if the selected text is more than 400kb
        if (selectedText.length > 400000) {
          throw new Error(
            'The selected text is more than 400kb. Please select a smaller text.'
          )
        }
        console.log(
          'Selected text is less than 400kb. Text length: ',
          selectedText.length,
          'bytes'
        )

        // Check if apiClient is available and use it if authenticated, otherwise fallback to direct axios
        let response
        if (apiClient) {
          try {
            // Use ApiClient which handles authentication automatically
            response = await apiClient.storePaste(selectedText, 'unknown', null, null)
            
            // Wrap response to match expected format
            response = {
              response: {
                id: response.id,
                message: response.message,
                timestamp: response.timestamp
              }
            }
          } catch (apiError) {
            // If ApiClient fails (e.g., not authenticated), fallback to direct axios
            console.log('ApiClient failed, falling back to direct axios:', apiError.message)
            
            // Fallback to direct axios
            const apiEndpoint = getApiEndpoint()
            const baseURL = `${apiEndpoint}/v1/store-paste`
            
            const axiosResponse = await axios.post(baseURL, {
              paste: selectedText,
              recipient_gh_username: 'unknown'
            }, {
              decompress: false,
              responseType: 'json',
              timeout: 30000,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity
            })
            
            response = axiosResponse.data
          }
        } else {
          // Fallback to direct axios if apiClient is not available
          const apiEndpoint = getApiEndpoint()
          const baseURL = `${apiEndpoint}/v1/store-paste`
          
          const axiosResponse = await axios.post(baseURL, {
            paste: selectedText,
            recipient_gh_username: 'unknown'
          }, {
            decompress: false,
            responseType: 'json',
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
          
          response = axiosResponse.data
        }

        const responseData = response
        if (!responseData || !responseData.response) {
          throw new Error('Invalid response format from server')
        }

        const { id, message, timestamp } = responseData.response
        
        if (!id) {
          throw new Error('Paste ID not received from server')
        }

        console.log('Paste stored successfully - ID:', id)
        
        // Update status bar to reflect successful connection
        updateStatusBar(true)
        
        // Refresh My Pastes view if user is authenticated
        if (authTreeProvider && apiClient && auth) {
          try {
            const isAuthenticated = await auth.isAuthenticated()
            if (isAuthenticated) {
              // Refresh pastes list to show the new paste
              await authTreeProvider.loadPastes()
            }
          } catch (refreshError) {
            // Non-critical error - just log it
            console.log('Failed to refresh pastes list:', refreshError.message)
          }
        }
        
        const clipboardText = multiLineClipboard(id)
        await vscode.env.clipboard.writeText(clipboardText)
        
        vscode.window.showInformationMessage(`Paste shared! ID: ${id}. Instructions copied to clipboard.`)
        console.log('Instructions copied to clipboard')
      } catch (error) {
        console.error('Error storing paste:', error)
        
        let errorMessage = 'Failed to store paste'
        if (error.response) {
          const status = error.response.status
          const errorData = error.response.data
          const serverMessage = (errorData && errorData.response && errorData.response.message) || error.message
          
          if (status === 400) {
            errorMessage = `Invalid request: ${serverMessage}`
          } else if (status >= 500) {
            errorMessage = 'Server error. Please try again later.'
          } else {
            errorMessage = serverMessage
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your internet connection.'
          // Update status bar to reflect connection failure
          updateStatusBar(false)
        } else {
          errorMessage = error.message || 'An unexpected error occurred'
        }
        
        vscode.window.showErrorMessage(`Failed to store paste: ${errorMessage}`)
      }
    }
  )

  const get_encrypted_paste = vscode.commands.registerCommand(
    'pasteportal.get-encrypted-paste',
    async function () {
      // check if user has accepted the service agreement or not
      if (!(await checkServiceAgreement())) {
        return
      }

      console.log('Command: pasteportal.get-encrypted-paste - started')
      // get the active text editor
      const editor = vscode.window.activeTextEditor
      // check if there is an active text editor
      if (!editor) throw new Error('No active text editor.')
      console.log('Active text editor found')

      try {
        const prompt = await vscode.window.showInputBox({
          prompt: 'Enter the paste ID or URL (e.g., abc123 or https://pasteportal.app/?id=abc123)'
        })

        if (!prompt) {
          vscode.window.showErrorMessage('Paste ID/URL is required')
          return
        }

        console.log('Prompt: ', prompt)

        const pasteId = getPasteId(prompt)
        console.log('Paste ID: ', pasteId)

        if (!pasteId) {
          vscode.window.showErrorMessage('Invalid paste ID or URL format. Please provide a valid ID (6-character hex or UUID) or URL.')
          return
        }

        // ask for the password
        const password = await vscode.window.showInputBox({
          prompt: 'Enter the password to decrypt the paste',
          password: true
        })

        if (!password) {
          vscode.window.showErrorMessage('Password is required')
          return
        }

        const apiEndpoint = getApiEndpoint()
        const baseURL = `${apiEndpoint}/get-paste?id=${pasteId}`
        
        const response = await axios.get(baseURL, {
          decompress: false,
          responseType: 'json',
          timeout: 10000,
          headers: {
            'Accept': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        })
        const responseData = response.data

        if (!responseData || !responseData.response) {
          throw new Error('Invalid response format from server')
        }

        const { paste, id, is_password_encrypted } = responseData.response

        if (!paste) {
          throw new Error('Paste content not found in response')
        }

        if (!is_password_encrypted) {
          vscode.window.showWarningMessage('This paste does not appear to be password-encrypted. It will be inserted as-is.')
        }

        console.log('Retrieved encrypted paste - ID:', id)

        // Decrypt the text
        try {
          const decryptedText = decrypt(password, paste)
          console.log('Decrypted successfully')

          // Update status bar to reflect successful connection
          updateStatusBar(true)

          // insert the paste content into the active editor
          await editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, decryptedText)
          })
          
          vscode.window.showInformationMessage('Encrypted paste retrieved and decrypted successfully.')
          return // Success, exit early
        } catch (decryptError) {
          console.error('Decryption error:', decryptError)
          // Check if it's a validation error
          if (decryptError.message && decryptError.message.includes('Password')) {
            throw new Error('Decryption failed: ' + decryptError.message)
          } else if (decryptError.message && decryptError.message.includes('Decryption')) {
            throw new Error('Decryption failed. Please check the password and try again.')
          } else {
            throw decryptError
          }
        }

      } catch (error) {
        console.error('Error retrieving encrypted paste:', error)
        
        let errorMessage = 'Failed to retrieve encrypted paste'
        if (error.response) {
          const status = error.response.status
          const errorData = error.response.data
          const serverMessage = (errorData && errorData.response && errorData.response.message) || error.message
          
          if (status === 400) {
            errorMessage = `Invalid paste ID or paste not found: ${serverMessage}`
          } else if (status === 404) {
            errorMessage = 'Paste not found. Please check the ID and try again.'
          } else if (status >= 500) {
            errorMessage = 'Server error. Please try again later.'
          } else {
            errorMessage = serverMessage
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your internet connection.'
          // Update status bar to reflect connection failure
          updateStatusBar(false)
        } else {
          // Check if it's a decryption error
          if (error.message && error.message.includes('Decryption')) {
            errorMessage = 'Decryption failed. Please check the password and try again.'
          } else {
            errorMessage = error.message || 'An unexpected error occurred'
          }
        }
        
        vscode.window.showErrorMessage(`Failed to retrieve encrypted paste: ${errorMessage}`)
      }
    }
  )

  const store_encrypted_paste = vscode.commands.registerCommand(
    'pasteportal.store-encrypted-paste',
    async function () {
      try {
        // check if user has accepted the service agreement or not
        if (!(await checkServiceAgreement())) {
          return
        }
        console.log('Command: pasteportal.store-encrypted-paste - started')
        // get the active text editor
        const editor = vscode.window.activeTextEditor
        //  check if there is an active text editor and if there isnt thwor an error using the catch
        if (!editor) throw new Error('No active text editor.')
        console.log('Active text editor found')
        // Get the selected text
        const selectedText = editor.document.getText(editor.selection)
        if (!selectedText) throw new Error('No text selected.')
        console.log('Selected text found')

        // check if the selected text is more than 400kb
        if (selectedText.length > 400000) {
          throw new Error(
            'The selected text is more than 400kb. Please select a smaller text.'
          )
        }
        console.log(
          'Selected text is less than 400kb. Text length: ',
          selectedText.length,
          'bytes'
        )

        // Ask user for password option: random or custom
        const passwordOption = await vscode.window.showQuickPick(
          [
            {
              label: '$(key) Use Random Password',
              description: 'A secure password will be generated automatically',
              id: 'random'
            },
            {
              label: '$(edit) Use Custom Password',
              description: 'Enter your own password',
              id: 'custom'
            }
          ],
          {
            placeHolder: 'Choose password option for encryption',
            ignoreFocusOut: true
          }
        )

        if (!passwordOption) {
          return // User cancelled
        }

        let password = null

        // Check if random password option was selected
        if (passwordOption.id === 'random' || passwordOption.label.includes('Random')) {
          // Generate random password
          password = generateRandomPassword(16)
          console.log('Random password generated')
        } else {
          // Get custom password from user
          password = await vscode.window.showInputBox({
            prompt: 'Enter the password to encrypt the paste (8-30 characters, no spaces)',
            password: true,
            placeHolder: 'Enter password',
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'Password cannot be empty'
              }
              if (value.length < passwordLengthMin) {
                return `Password must be at least ${passwordLengthMin} characters long`
              }
              if (value.length > passwordLengthMax) {
                return `Password must be less than ${passwordLengthMax} characters long`
              }
              if (/[\s\t\n\r\v\f\0]/.test(value)) {
                return 'Password should not contain whitespace characters'
              }
              return null
            }
          })

          if (!password) {
            return // User cancelled or validation failed
          }
        }

        // Encrypt the paste content
        let encryptedPaste
        try {
          encryptedPaste = encrypt(password, selectedText)
          console.log('Selected text encrypted successfully')
        } catch (encryptError) {
          console.error('Encryption error:', encryptError)
          vscode.window.showErrorMessage(`Encryption failed: ${encryptError.message || 'Unknown error'}`)
          return
        }

        // Check if apiClient is available and use it if authenticated, otherwise fallback to direct axios
        let response
        if (apiClient) {
          try {
            // Use ApiClient which handles authentication automatically
            // For password-protected pastes, we need to pass the password so it can be stored
            response = await apiClient.storePaste(encryptedPaste, 'unknown', null, password)
            
            // Wrap response to match expected format
            response = {
              response: {
                id: response.id,
                message: response.message,
                timestamp: response.timestamp
              }
            }
          } catch (apiError) {
            // If ApiClient fails (e.g., not authenticated), fallback to direct axios
            console.log('ApiClient failed, falling back to direct axios:', apiError.message)
            
            // Fallback to direct axios
            const apiEndpoint = getApiEndpoint()
            const baseURL = `${apiEndpoint}/v1/store-paste`
            
            const axiosResponse = await axios.post(baseURL, {
              paste: encryptedPaste,
              recipient_gh_username: 'unknown',
              password: password
            }, {
              decompress: false,
              responseType: 'json',
              timeout: 30000,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity
            })
            
            response = axiosResponse.data
          }
        } else {
          // Fallback to direct axios if apiClient is not available
          const apiEndpoint = getApiEndpoint()
          const baseURL = `${apiEndpoint}/v1/store-paste`
          
          const axiosResponse = await axios.post(baseURL, {
            paste: encryptedPaste,
            recipient_gh_username: 'unknown',
            password: password
          }, {
            decompress: false,
            responseType: 'json',
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
          
          response = axiosResponse.data
        }

        const responseData = response
        if (!responseData || !responseData.response) {
          throw new Error('Invalid response format from server')
        }

        const { id, message, timestamp } = responseData.response
        
        if (!id) {
          throw new Error('Paste ID not received from server')
        }

        console.log('Encrypted paste stored successfully - ID:', id)
        
        // Update status bar to reflect successful connection
        updateStatusBar(true)
        
        // Refresh My Pastes view if user is authenticated
        if (authTreeProvider && apiClient && auth) {
          try {
            const isAuthenticated = await auth.isAuthenticated()
            if (isAuthenticated) {
              // Refresh pastes list to show the new paste
              await authTreeProvider.loadPastes()
            }
          } catch (refreshError) {
            // Non-critical error - just log it
            console.log('Failed to refresh pastes list:', refreshError.message)
          }
        }
        
        const clipboardText = multiLineClipboard(id, password)
        await vscode.env.clipboard.writeText(clipboardText)
        
        vscode.window.showInformationMessage(`Encrypted paste shared! ID: ${id}. Instructions (including password) copied to clipboard.`)
        console.log('Instructions copied to clipboard')
      } catch (error) {
        console.error('Error storing encrypted paste:', error)
        
        let errorMessage = 'Failed to store encrypted paste'
        if (error.response) {
          const status = error.response.status
          const errorData = error.response.data
          const serverMessage = (errorData && errorData.response && errorData.response.message) || error.message
          
          if (status === 400) {
            errorMessage = `Invalid request: ${serverMessage}`
          } else if (status >= 500) {
            errorMessage = 'Server error. Please try again later.'
          } else {
            errorMessage = serverMessage
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your internet connection.'
          // Update status bar to reflect connection failure
          updateStatusBar(false)
        } else {
          // Check if it's an encryption error
          if (error.message && error.message.includes('Password')) {
            errorMessage = `Encryption failed: ${error.message}`
          } else {
            errorMessage = error.message || 'An unexpected error occurred'
          }
        }
        
        vscode.window.showErrorMessage(`Failed to store encrypted paste: ${errorMessage}`)
      }
    }
  )

  const openInBrowserCommand = vscode.commands.registerCommand('pasteportal.openInBrowser', async () => {
    const domain = getDomain()
    await vscode.env.openExternal(vscode.Uri.parse(domain))
  })

  // Alias commands for menu compatibility
  const shareSelectionCommand = vscode.commands.registerCommand('pasteportal.shareSelection', async () => {
    // Execute the store-paste command (which handles selected text)
    return vscode.commands.executeCommand('pasteportal.store-paste')
  })

  const shareFileCommand = vscode.commands.registerCommand('pasteportal.shareFile', async () => {
    try {
      if (!(await checkServiceAgreement())) {
        return
      }
      
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showErrorMessage('No active text editor.')
        return
      }

      // Get entire file content
      const fileContent = editor.document.getText()
      if (!fileContent) {
        vscode.window.showErrorMessage('File is empty.')
        return
      }

      // Check file size (400KB limit)
      if (fileContent.length > 400000) {
        vscode.window.showErrorMessage('The file is more than 400kb. Please select a smaller file.')
        return
      }

      // Use ApiClient if available, otherwise fallback to direct axios
      let response
      if (apiClient) {
        try {
          // Use ApiClient which handles authentication automatically
          response = await apiClient.storePaste(fileContent, 'unknown', null, null)
          
          // Wrap response to match expected format
          response = {
            response: {
              id: response.id,
              message: response.message,
              timestamp: response.timestamp
            }
          }
        } catch (apiError) {
          // If ApiClient fails (e.g., not authenticated), fallback to direct axios
          console.log('ApiClient failed, falling back to direct axios:', apiError.message)
          
          // Fallback to direct axios
          const apiEndpoint = getApiEndpoint()
          const baseURL = `${apiEndpoint}/v1/store-paste`
          
          const axiosResponse = await axios.post(baseURL, {
            paste: fileContent,
            recipient_gh_username: 'unknown'
          }, {
            decompress: false,
            responseType: 'json',
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
          
          response = axiosResponse.data
        }
      } else {
        // Fallback to direct axios if apiClient is not available
        const apiEndpoint = getApiEndpoint()
        const baseURL = `${apiEndpoint}/v1/store-paste`
        
        const axiosResponse = await axios.post(baseURL, {
          paste: fileContent,
          recipient_gh_username: 'unknown'
        }, {
          decompress: false,
          responseType: 'json',
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        })
        
        response = axiosResponse.data
      }

      const responseData = response
      if (!responseData || !responseData.response) {
        throw new Error('Invalid response format from server')
      }

      const { id, message, timestamp } = responseData.response
      
      if (!id) {
        throw new Error('Paste ID not received from server')
      }

      updateStatusBar(true)
      
      // Refresh My Pastes view if user is authenticated
      if (authTreeProvider && apiClient && auth) {
        try {
          const isAuthenticated = await auth.isAuthenticated()
          if (isAuthenticated) {
            // Refresh pastes list to show the new paste
            await authTreeProvider.loadPastes()
          }
        } catch (refreshError) {
          // Non-critical error - just log it
          console.log('Failed to refresh pastes list:', refreshError.message)
        }
      }
      
      const clipboardText = multiLineClipboard(id)
      await vscode.env.clipboard.writeText(clipboardText)
      
      vscode.window.showInformationMessage(`File shared! ID: ${id}. Instructions copied to clipboard.`)
    } catch (error) {
      console.error('Error sharing file:', error)
      let errorMessage = 'Failed to share file'
      if (error.response) {
        const status = error.response.status
        const errorData = error.response.data
        const serverMessage = (errorData && errorData.response && errorData.response.message) || error.message
        
        if (status === 400) {
          errorMessage = `Invalid request: ${serverMessage}`
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.'
        } else {
          errorMessage = serverMessage
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.'
        updateStatusBar(false)
      } else {
        errorMessage = error.message || 'An unexpected error occurred'
      }
      
      vscode.window.showErrorMessage(`Failed to share file: ${errorMessage}`)
    }
  })

  const getPasteCommand = vscode.commands.registerCommand('pasteportal.getPaste', async () => {
    // Execute the get-paste command
    return vscode.commands.executeCommand('pasteportal.get-paste')
  })

  const getEncryptedPasteCommand = vscode.commands.registerCommand('pasteportal.getEncryptedPaste', async () => {
    // Execute the get-encrypted-paste command
    return vscode.commands.executeCommand('pasteportal.get-encrypted-paste')
  })

  const createPasteCommand = vscode.commands.registerCommand('pasteportal.createPaste', async () => {
    try {
      if (!(await checkServiceAgreement())) {
        return
      }

      // Open a new document for creating a paste
      const document = await vscode.workspace.openTextDocument({
        content: '',
        language: 'plaintext'
      })
      await vscode.window.showTextDocument(document)
      
      vscode.window.showInformationMessage('New document opened. Write your content and use "Store Paste" to share it.')
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create new paste: ${error.message}`)
    }
  })

  const copyPasteIdCommand = vscode.commands.registerCommand('pasteportal.copyPasteId', async (arg) => {
    // Handle different argument types: string (pasteId), object (tree item), or undefined
    let pasteId = null
    if (typeof arg === 'string') {
      pasteId = arg
    } else if (arg && (arg.pasteId || arg.id)) {
      pasteId = arg.pasteId || arg.id
    }

    if (!pasteId) {
      pasteId = await vscode.window.showInputBox({
        prompt: 'Enter the paste ID to copy',
        placeHolder: 'abc123 or UUID',
        ignoreFocusOut: true
      })
    }

    if (pasteId) {
      await vscode.env.clipboard.writeText(pasteId)
      vscode.window.showInformationMessage(`Paste ID copied to clipboard: ${pasteId}`)
    }
  })

  context.subscriptions.push(get_paste)
  context.subscriptions.push(store_paste)
  context.subscriptions.push(get_encrypted_paste)
  context.subscriptions.push(store_encrypted_paste)
  context.subscriptions.push(openInBrowserCommand)
  context.subscriptions.push(shareSelectionCommand)
  context.subscriptions.push(shareFileCommand)
  context.subscriptions.push(getPasteCommand)
  context.subscriptions.push(getEncryptedPasteCommand)
  context.subscriptions.push(createPasteCommand)
  context.subscriptions.push(copyPasteIdCommand)
}


function deactivate() {
  // Cleanup is handled by VSCode through subscriptions
  // Clean up connectivity check interval
  if (connectivityCheckInterval) {
    clearInterval(connectivityCheckInterval)
    connectivityCheckInterval = null
  }
}

module.exports = {
  activate,
  deactivate
}
