const vscode = require('vscode')
const axios = require('axios')

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
   * @private
   */
  _initializeConfig() {
    const config = vscode.workspace.getConfiguration('pasteportal')
    this.apiEndpoint = config.get('apiEndpoint', 'https://pasteportal.app/api')
    this.baseUrl = this.apiEndpoint.replace(/\/api$/, '') || 'https://pasteportal.app'
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
    const headers = {
      'Content-Type': 'application/json'
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
   * @returns {Promise<Object>}
   * @throws {Error}
   */
  async storePaste(content, recipientGhUsername = 'unknown', name = null, password = null) {
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

      const response = await axios.post(url, body, { headers })
      
      if (!response.data || !response.data.response) {
        throw new Error('Invalid response format from server')
      }

      return response.data.response
    } catch (error) {
      if (error.response) {
        const status = error.response.status
        const errorData = error.response.data
        const message = (errorData && errorData.response && errorData.response.message) || error.message
        
        if (status === 400) {
          throw new Error(`Invalid request: ${message}`)
        }
        if (status === 401) {
          throw new Error(`Authentication required: ${message}`)
        }
        if (status === 403) {
          throw new Error(`Forbidden: ${message}`)
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
      
      const response = await axios.get(url, { headers })
      
      if (!response.data) {
        throw new Error('Invalid response format from server')
      }

      return response.data
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
        throw new Error(`API error: ${message}`)
      }
      
      if (error.request) {
        throw new Error('Network error. Please check your internet connection.')
      }
      
      throw error
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

