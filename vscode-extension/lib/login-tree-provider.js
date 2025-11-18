const vscode = require('vscode')
const Auth = require('./auth')

/**
 * Tree item types
 */
class LoginTreeItem extends vscode.TreeItem {
  constructor(label, collapsibleState, command, iconId = null) {
    super(label, collapsibleState)
    this.command = command
    if (iconId) {
      this.iconPath = new vscode.ThemeIcon(iconId)
    }
  }
}

/**
 * Login Tree Data Provider
 * Shows authentication UI when not logged in, and user info when authenticated
 */
class LoginTreeProvider {
  /**
   * Create a new LoginTreeProvider
   * @param {Auth} auth - Auth instance
   */
  constructor(auth) {
    this.auth = auth
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.onDidChangeTreeData = this._onDidChangeTreeData.event
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
          new LoginTreeItem(
            'Initializing...',
            vscode.TreeItemCollapsibleState.None
          )
        ]
      }

      // Check if Supabase is configured
      let isConfigured = false
      try {
        isConfigured = this.auth.isConfigured()
      } catch (error) {
        console.error('Error checking if auth is configured:', error)
        return [
          new LoginTreeItem(
            'Error: Authentication not configured',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'workbench.action.openSettings',
              title: 'Open Settings',
              arguments: ['@id:pasteportal.supabase']
            },
            'alert'
          )
        ]
      }

      if (!isConfigured) {
        return [
          new LoginTreeItem(
            'Supabase not configured',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'workbench.action.openSettings',
              title: 'Open Settings',
              arguments: ['@id:pasteportal.supabase']
            },
            'alert'
          ),
          new LoginTreeItem(
            'Configure Supabase URL and Anon Key in settings',
            vscode.TreeItemCollapsibleState.None
          )
        ]
      }

      // Check authentication status
      let isAuthenticated = false
      try {
        isAuthenticated = await this.auth.isAuthenticated()
      } catch (error) {
        console.error('Error checking authentication status:', error)
        return [
          new LoginTreeItem(
            'Error checking authentication',
            vscode.TreeItemCollapsibleState.None,
            null,
            'error'
          ),
          new LoginTreeItem(
            'Sign In',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'pasteportal.sign-in',
              title: 'Sign In'
            },
            'sign-in'
          )
        ]
      }

      if (!isAuthenticated) {
        // Show authentication options
        return [
          new LoginTreeItem(
            'Sign In',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'pasteportal.sign-in',
              title: 'Sign In'
            },
            'sign-in'
          ),
          new LoginTreeItem(
            'Sign Up',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'pasteportal.sign-up',
              title: 'Sign Up'
            },
            'add'
          )
        ]
      }

      // User is authenticated - show user info and sign out
      let user = null
      try {
        user = await this.auth.getCurrentUser()
      } catch (error) {
        console.error('Error getting current user:', error)
        // Still show sign out option even if we can't get user info
        return [
          new LoginTreeItem(
            'Signed in',
            vscode.TreeItemCollapsibleState.None,
            null,
            'account'
          ),
          new LoginTreeItem(
            'Sign Out',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'pasteportal.sign-out',
              title: 'Sign Out'
            },
            'sign-out'
          )
        ]
      }

      const userEmail = user?.email || 'Unknown'

      return [
        new LoginTreeItem(
          userEmail,
          vscode.TreeItemCollapsibleState.None,
          null,
          'account'
        ),
        new LoginTreeItem(
          'Sign Out',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'pasteportal.sign-out',
            title: 'Sign Out'
          },
          'sign-out'
        )
      ]
    } catch (error) {
      console.error('Error in LoginTreeProvider.getChildren:', error)
      return [
        new LoginTreeItem(
          `Error: ${error.message || 'Unknown error'}`,
          vscode.TreeItemCollapsibleState.None,
          null,
          'error'
        )
      ]
    }
  }
}

module.exports = LoginTreeProvider

