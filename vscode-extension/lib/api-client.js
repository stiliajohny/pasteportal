const vscode = require('vscode')
const axios = require('axios')
const os = require('os')

/**
 * API Client for PastePortal
 * Handles authenticated API requests to PastePortal endpoints
 */
class ApiClient {
  /**
   * Create a new ApiClient instance
   * @param {Auth} auth - Auth instance for authentication
   */
  constructor(auth) {
    this.auth = auth
    this.baseUrl = null
    this.apiEndpoint = null
    this._initializeConfig()
  }

  /**
   * Initialize configuration from VS Code settings
   * Uses serverUrl if apiEndpoint is not explicitly set
   * @private
   */
  _initializeConfig() {
    const config = vscode.workspace.getConfiguration('pasteportal')
    
    // Check if apiEndpoint is explicitly configured (not using default)
    const apiEndpointInspect = config.inspect('apiEndpoint')
    const isApiEndpointExplicit = apiEndpointInspect && (
      apiEndpointInspect.globalValue !== undefined ||
      apiEndpointInspect.workspaceValue !== undefined ||
      apiEndpointInspect.workspaceFolderValue !== undefined
    )
    
    if (isApiEndpointExplicit) {
      this.apiEndpoint = config.get('apiEndpoint', 'https://pasteportal.app/api')
    } else {
      // Otherwise, derive from serverUrl
      const serverUrl = config.get('serverUrl', 'http://localhost:3000')
      // Ensure serverUrl doesn't end with /api
      const baseUrl = serverUrl.replace(/\/api$/, '')
      this.apiEndpoint = `${baseUrl}/api`
    }
    
    this.baseUrl = this.apiEndpoint.replace(/\/api$/, '') || config.get('serverUrl', 'http://localhost:3000')
  }

  /**
   * Refresh configuration (call when settings change)
   */
  refreshConfig() {
    this._initializeConfig()
  }

  /**
   * Get headers for API requests
   * @returns {Promise<Object>}
   */
  async _getHeaders() {
    // Always set platform to 'vscode' for VS Code extension
    const headers = {
      'Content-Type': 'application/json',
      'X-Platform': 'vscode'  // Always set platform for VS Code extension
    }

    // Add hostname header if available
    try {
      const hostname = os.hostname()
      if (hostname && hostname.trim()) {
        headers['X-Hostname'] = hostname.trim()
      }
    } catch (error) {
      // Log error for debugging
      console.error('[ApiClient] _getHeaders - Could not retrieve hostname:', error.message)
    }

    // Get access token if authenticated
    if (this.auth) {
      try {
        const accessToken = await this.auth.getAccessToken()
        if (accessToken) {
          // For Supabase, we use the access token in Authorization header
          headers['Authorization'] = `Bearer ${accessToken}`
        }
      } catch (error) {
        console.error('Error getting access token:', error.message)
      }
    }
    
    return headers
  }

  /**
   * Get paste by ID
   * @param {string} pasteId - Paste ID (UUID or 6-character hex)
   * @returns {Promise<Object>}
   * @throws {Error}
   */
  async getPaste(pasteId) {
    try {
      const headers = await this._getHeaders()
      const url = `${this.apiEndpoint}/v1/get-paste?id=${encodeURIComponent(pasteId)}`
      
      const response = await axios.get(url, { headers })
      
      if (!response.data || !response.data.response) {
        throw new Error('Invalid response format from server')
      }

      return response.data.response
    } catch (error) {
      if (error.response) {
        const status = error.response.status
        const errorData = error.response.data
        const message = (errorData && errorData.response && errorData.response.message) || error.message
        
        if (status === 400 || status === 404) {
          throw new Error(`Paste not found: ${message}`)
        }
        throw new Error(`API error: ${message}`)
      }
      
      if (error.request) {
        throw new Error('Network error. Please check your internet connection.')
      }
      
      throw error
    }
  }

  /**
   * Store a new paste
   * @param {string} content - Paste content
   * @param {string} recipientGhUsername - Recipient GitHub username
   * @param {string|null} name - Optional paste name
   * @param {string|null} password - Optional password for password-protected paste
   * @param {string|null} tags - Optional tags (comma-separated string)
   * @returns {Promise<Object>}
   * @throws {Error}
   */
  async storePaste(content, recipientGhUsername = 'unknown', name = null, password = null, tags = null) {
    try {
      const headers = await this._getHeaders()
      const url = `${this.apiEndpoint}/v1/store-paste`
      
      const body = {
        paste: content,
        recipient_gh_username: recipientGhUsername
      }

      // Add optional fields
      if (name) {
        body.name = name
      }
      if (password) {
        body.password = password
      }
      if (tags) {
        body.tags = tags
      }

      // Add user_id if authenticated
      if (this.auth) {
        const isAuthenticated = await this.auth.isAuthenticated()
        if (isAuthenticated) {
          const user = await this.auth.getCurrentUser()
          if (user) {
            body.user_id = user.id
          }
        }
      }

      // Ensure headers are properly formatted for axios
      // Axios should preserve header case, but let's be explicit
      const axiosConfig = {
        headers: {
          ...headers,
          // Explicitly set headers to ensure they're sent
          'X-Platform': headers['X-Platform'] || 'vscode',
          'X-Hostname': headers['X-Hostname'] || undefined,
        },
        // Remove undefined headers
      }
      
      // Clean up undefined headers
      Object.keys(axiosConfig.headers).forEach(key => {
        if (axiosConfig.headers[key] === undefined) {
          delete axiosConfig.headers[key]
        }
      })
      
      const response = await axios.post(url, body, axiosConfig)
      
      if (!response.data || !response.data.response) {
        throw new Error('Invalid response format from server')
      }

      return response.data.response
    } catch (error) {
      if (error.response) {
        const status = error.response.status
        const errorData = error.response.data
        const message = (errorData && errorData.response && errorData.response.message) || error.message
        const existingId = errorData && errorData.response && errorData.response.existing_id
        
        if (status === 400) {
          throw new Error(`Invalid request: ${message}`)
        }
        if (status === 401) {
          throw new Error(`Authentication required: ${message}`)
        }
        if (status === 403) {
          throw new Error(`Forbidden: ${message}`)
        }
        if (status === 409) {
          // Duplicate paste detected - include existing ID in error
          const duplicateError = new Error(message)
          duplicateError.existingId = existingId
          duplicateError.status = 409
          throw duplicateError
        }
        throw new Error(`API error: ${message}`)
      }
      
      if (error.request) {
        throw new Error('Network error. Please check your internet connection.')
      }
      
      throw error
    }
  }

  /**
   * List user's pastes (requires authentication)
   * @returns {Promise<Object>}
   * @throws {Error}
   */
  async listUserPastes() {
    try {
      const headers = await this._getHeaders()
      const url = `${this.apiEndpoint}/v1/list-pastes`
      
      const response = await axios.get(url, {
        headers,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        decompress: true, // Allow automatic decompression of gzip/deflate responses
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      
      // Parse response data if it's a string (axios sometimes doesn't auto-parse)
      let responseData = response.data
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData)
        } catch (parseError) {
          console.error('[ApiClient] listUserPastes() - Failed to parse JSON:', parseError)
          throw new Error('Invalid JSON response from server')
        }
      }
      
      // Check for error status codes
      if (response.status === 401) {
        throw new Error('Authentication required. Please sign in.')
      }
      if (response.status === 403) {
        const errorData = responseData
        const message = (errorData && errorData.error) || 'Forbidden'
        throw new Error(`Forbidden: ${message}`)
      }
      if (response.status >= 400) {
        const errorData = responseData
        const message = (errorData && errorData.error) || `HTTP ${response.status} error`
        throw new Error(`API error: ${message}`)
      }
      
      if (!responseData) {
        throw new Error('Invalid response format from server')
      }

      return responseData
    } catch (error) {
      console.error('[ApiClient] listUserPastes() - Error caught:', error)
      console.error('[ApiClient] listUserPastes() - Error type:', error.constructor.name)
      console.error('[ApiClient] listUserPastes() - Error message:', error.message)
      
      // Handle axios errors
      if (error.response) {
        const status = error.response.status
        const errorData = error.response.data
        const message = (errorData && errorData.error) || error.message
        
        if (status === 401) {
          throw new Error('Authentication required. Please sign in.')
        }
        if (status === 403) {
          throw new Error(`Forbidden: ${message}`)
        }
        throw new Error(`API error: ${message}`)
      }
      
      if (error.request) {
        // Network error - provide more helpful message
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout. Please check your internet connection and try again.')
        }
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to server. Please check your API endpoint configuration: ${this.apiEndpoint}`)
        }
        throw new Error(`Network error: ${error.message || 'Please check your internet connection.'}`)
      }
      
      // Re-throw if it's already a formatted error
      if (error.message && (error.message.includes('Authentication') || error.message.includes('Forbidden') || error.message.includes('API error'))) {
        throw error
      }
      
      throw new Error(`Failed to retrieve pastes: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Delete a paste (requires authentication)
   * @param {string} pasteId - Paste ID
   * @returns {Promise<void>}
   * @throws {Error}
   */
  async deletePaste(pasteId) {
    try {
      const headers = await this._getHeaders()
      const url = `${this.apiEndpoint}/v1/delete-paste?id=${encodeURIComponent(pasteId)}`
      
      await axios.delete(url, { headers })
    } catch (error) {
      if (error.response) {
        const status = error.response.status
        const errorData = error.response.data
        const message = (errorData && errorData.error) || error.message
        
        if (status === 401) {
          throw new Error('Authentication required. Please sign in.')
        }
        if (status === 403) {
          throw new Error(`Forbidden: ${message}`)
        }
        if (status === 404) {
          throw new Error('Paste not found.')
        }
        throw new Error(`API error: ${message}`)
      }
      
      if (error.request) {
        throw new Error('Network error. Please check your internet connection.')
      }
      
      throw error
    }
  }
}

module.exports = ApiClient

