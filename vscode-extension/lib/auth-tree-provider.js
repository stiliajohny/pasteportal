const vscode = require('vscode')
const Auth = require('./auth')
const ApiClient = require('./api-client')

/**
 * Tree item types
 */
class AuthTreeItem extends vscode.TreeItem {
  constructor(label, collapsibleState, command) {
    super(label, collapsibleState)
    this.command = command
  }
}

class PasteTreeItem extends vscode.TreeItem {
  constructor(paste, command) {
    const label = paste.display_name || paste.name || new Date(paste.created_at).toLocaleString()
    const icon = paste.is_password_encrypted ? '$(lock)' : '$(file-text)'
    super(`${icon} ${label}`, vscode.TreeItemCollapsibleState.None)
    
    this.pasteId = paste.id
    this.id = paste.id // For context menu identification
    this.contextValue = 'paste'
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
 * Authentication Tree Data Provider
 * Shows authentication UI when not logged in, and user's paste list when authenticated
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
    if (element) {
      return []
    }

    // Check if Supabase is configured
    if (!this.auth.isConfigured()) {
      return [
        new AuthTreeItem(
          '$(alert) Supabase not configured',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'workbench.action.openSettings',
            title: 'Open Settings',
            arguments: ['@id:pasteportal.supabase']
          }
        ),
        new AuthTreeItem(
          'Configure Supabase URL and Anon Key in settings',
          vscode.TreeItemCollapsibleState.None
        )
      ]
    }

    // Check authentication status
    const isAuthenticated = await this.auth.isAuthenticated()

    if (!isAuthenticated) {
      // Show authentication options
      return [
        new AuthTreeItem(
          '$(sign-in) Sign In',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'pasteportal.sign-in',
            title: 'Sign In'
          }
        ),
        new AuthTreeItem(
          '$(add) Sign Up',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'pasteportal.sign-up',
            title: 'Sign Up'
          }
        ),
        new AuthTreeItem(
          'Sign in to view your pastes',
          vscode.TreeItemCollapsibleState.None
        )
      ]
    }

    // User is authenticated - show user info and pastes
    const user = await this.auth.getCurrentUser()
    const userEmail = user?.email || 'Unknown'

    const items = [
      new AuthTreeItem(
        `$(account) ${userEmail}`,
        vscode.TreeItemCollapsibleState.None
      ),
      new AuthTreeItem(
        '$(sign-out) Sign Out',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'pasteportal.sign-out',
          title: 'Sign Out'
        }
      ),
      new AuthTreeItem(
        '$(refresh) Refresh',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'pasteportal.refresh-pastes',
          title: 'Refresh Pastes'
        }
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
        `$(error) Error: ${this.error}`,
        vscode.TreeItemCollapsibleState.None
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

    // Add paste items
    this.pastes.forEach(paste => {
      const pasteItem = new PasteTreeItem(paste, {
        command: 'pasteportal.view-paste',
        title: 'View Paste',
        arguments: [paste.id]
      })
      pasteItem.id = paste.id // Store ID for context menu
      items.push(pasteItem)
    })

    return items
  }

  /**
   * Load user's pastes
   */
  async loadPastes() {
    this.loading = true
    this.error = null
    this.refresh()

    try {
      const result = await this.apiClient.listUserPastes()
      this.pastes = result.pastes || []
      this.loading = false
      this.refresh()
    } catch (error) {
      this.error = error.message
      this.loading = false
      this.pastes = []
      this.refresh()
    }
  }

  /**
   * Clear pastes list
   */
  clearPastes() {
    this.pastes = []
    this.error = null
    this.loading = false
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
}

module.exports = AuthTreeProvider

