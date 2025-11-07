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
    if (element) {
      return []
    }

    // Check if Supabase is configured
    if (!this.auth.isConfigured()) {
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
    const isAuthenticated = await this.auth.isAuthenticated()

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
    const user = await this.auth.getCurrentUser()
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
  }
}

module.exports = LoginTreeProvider

