const vscode = require('vscode')
const Auth = require('../auth')
const ApiClient = require('../api-client')

/**
 * Tree item types
 */
class AuthTreeItem extends vscode.TreeItem {
  constructor(label, collapsibleState, command, iconId = null) {
    super(label, collapsibleState)
    this.command = command
    if (iconId) {
      this.iconPath = new vscode.ThemeIcon(iconId)
    }
  }
}

class PasteTreeItem extends vscode.TreeItem {
  constructor(paste, command) {
    const label = paste.display_name || paste.name || new Date(paste.created_at).toLocaleString()
    super(label, vscode.TreeItemCollapsibleState.None)
    
    // Set icon using ThemeIcon
    this.iconPath = new vscode.ThemeIcon(paste.is_password_encrypted ? 'lock' : 'file-text')
    
    this.pasteId = paste.id
    this.id = paste.id // For context menu identification
    this.paste = paste // Store full paste object for context menu actions
    // Set contextValue based on whether paste is password protected
    this.contextValue = paste.is_password_encrypted ? 'paste.encrypted' : 'paste'
    this.tooltip = `ID: ${paste.id}\nCreated: ${new Date(paste.created_at).toLocaleString()}\n${paste.is_password_encrypted ? 'Encrypted' : 'Plain text'}`
    this.description = new Date(paste.created_at).toLocaleDateString()
    this.command = command
  }
}

class LoadingTreeItem extends vscode.TreeItem {
  constructor() {
    super('Loading...', vscode.TreeItemCollapsibleState.None)
    this.iconPath = new vscode.ThemeIcon('loading~spin')
  }
}

/**
 * Pastes Tree Data Provider
 * Shows user's paste list when authenticated
 */
class AuthTreeProvider {
  /**
   * Create a new AuthTreeProvider
   * @param {Auth} auth - Auth instance
   * @param {ApiClient} apiClient - ApiClient instance
   */
  constructor(auth, apiClient) {
    this.auth = auth
    this.apiClient = apiClient
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.onDidChangeTreeData = this._onDidChangeTreeData.event
    this.pastes = []
    this.loading = false
    this.error = null
    this.sortAscending = true // true = ascending (oldest first), false = descending (newest first)
    this.hasAttemptedLoad = false // Track if we've attempted to load pastes
  }

  /**
   * Refresh tree data
   */
  refresh() {
    this._onDidChangeTreeData.fire()
  }

  /**
   * Get tree item for a given element
   * @param {*} element - Tree element
   * @returns {Promise<vscode.TreeItem>}
   */
  async getTreeItem(element) {
    return element
  }

  /**
   * Get children for a given element
   * @param {*} element - Parent element (null for root)
   * @returns {Promise<vscode.TreeItem[]>}
   */
  async getChildren(element) {
    try {
      if (element) {
        return []
      }

      // Check if auth is available
      if (!this.auth) {
        return [
          new AuthTreeItem(
            'Initializing...',
            vscode.TreeItemCollapsibleState.None
          )
        ]
      }

      // Check authentication status
      let isAuthenticated = false
      try {
        isAuthenticated = await this.auth.isAuthenticated()
      } catch (error) {
        console.error('[AuthTreeProvider] Error checking authentication status:', error)
        return [
          new AuthTreeItem(
            'Error checking authentication',
            vscode.TreeItemCollapsibleState.None,
            null,
            'error'
          )
        ]
      }

      if (!isAuthenticated) {
        // Return empty array when not authenticated
        this.hasAttemptedLoad = false // Reset flag when not authenticated
        return []
      }

    // User is authenticated - automatically load pastes if not already loaded
    if (!this.hasAttemptedLoad && !this.loading && this.apiClient) {
      // Trigger load in background (don't await to avoid blocking UI)
      this.hasAttemptedLoad = true
      this.loadPastes().catch(error => {
        console.error('[AuthTreeProvider] Error auto-loading pastes:', error)
        // Reset flag on error so we can retry
        this.hasAttemptedLoad = false
      })
    }

    // User is authenticated - show refresh button, sort toggle, and pastes
    const sortIcon = this.sortAscending ? 'arrow-up' : 'arrow-down'
    const sortLabel = this.sortAscending ? 'Sort: Oldest First' : 'Sort: Newest First'
    
    const items = [
      new AuthTreeItem(
        'Refresh',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'pasteportal.refresh-pastes',
          title: 'Refresh Pastes'
        },
        'refresh'
      ),
      new AuthTreeItem(
        sortLabel,
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'pasteportal.toggle-pastes-sort',
          title: 'Toggle Sort Order'
        },
        sortIcon
      )
    ]

    // Add separator
    items.push(new AuthTreeItem('', vscode.TreeItemCollapsibleState.None))

    // Load pastes
    if (this.loading) {
      items.push(new LoadingTreeItem())
      return items
    }

    if (this.error) {
      items.push(new AuthTreeItem(
        `Error: ${this.error}`,
        vscode.TreeItemCollapsibleState.None,
        null,
        'error'
      ))
      return items
    }

    if (this.pastes.length === 0) {
      items.push(new AuthTreeItem(
        'No pastes found. Create your first paste!',
        vscode.TreeItemCollapsibleState.None
      ))
      return items
    }

    // Sort pastes by created_at date
    const sortedPastes = [...this.pastes].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return this.sortAscending ? dateA - dateB : dateB - dateA
    })

    // Add paste items
    sortedPastes.forEach(paste => {
      const pasteItem = new PasteTreeItem(paste, null)
      pasteItem.id = paste.id // Store ID for context menu
      items.push(pasteItem)
    })

    return items
    } catch (error) {
      console.error('Error in AuthTreeProvider.getChildren:', error)
      return [
        new AuthTreeItem(
          `Error: ${error.message || 'Unknown error'}`,
          vscode.TreeItemCollapsibleState.None,
          null,
          'error'
        )
      ]
    }
  }

  /**
   * Load user's pastes
   */
  async loadPastes() {
    // First verify authentication before loading
    const isAuthenticated = await this.auth.isAuthenticated()
    
    if (!isAuthenticated) {
      // Don't set error - just clear pastes and refresh to show sign-in options
      this.error = null
      this.loading = false
      this.pastes = []
      this.hasAttemptedLoad = false // Reset flag when not authenticated
      this.refresh()
      return
    }

    this.loading = true
    this.error = null
    this.hasAttemptedLoad = true
    this.refresh()

    try {
      const result = await this.apiClient.listUserPastes()
      
      this.pastes = result.pastes || []
      
      this.loading = false
      this.error = null
      this.refresh()
    } catch (error) {
      console.error('[AuthTreeProvider] loadPastes() - Error occurred:', error)
      console.error('[AuthTreeProvider] loadPastes() - Error message:', error.message)
      console.error('[AuthTreeProvider] loadPastes() - Error stack:', error.stack)
      
      // Check if it's an authentication error
      if (error.message && (error.message.includes('Authentication required') || error.message.includes('401'))) {
        // Clear error state and refresh to re-check authentication
        // This will show sign-in options if user is not authenticated
        this.error = null
        this.pastes = []
        this.loading = false
        this.hasAttemptedLoad = false // Reset flag on auth error
        this.refresh()
      } else {
        // Show other errors (network, server errors, etc.)
        this.error = error.message
        this.loading = false
        this.refresh()
      }
    }
  }

  /**
   * Clear pastes list
   */
  clearPastes() {
    this.pastes = []
    this.error = null
    this.loading = false
    this.hasAttemptedLoad = false // Reset flag when clearing
    this.refresh()
  }

  /**
   * Get paste by ID
   * @param {string} pasteId - Paste ID
   * @returns {Object|null}
   */
  getPaste(pasteId) {
    return this.pastes.find(p => p.id === pasteId) || null
  }

  /**
   * Toggle sort order
   */
  toggleSort() {
    this.sortAscending = !this.sortAscending
    this.refresh()
  }
}

module.exports = AuthTreeProvider

