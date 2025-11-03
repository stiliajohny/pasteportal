const vscode = require('vscode')

/**
 * Operations Tree Data Provider
 * Shows available PastePortal operations in the sidebar
 */
class OperationsTreeProvider {
  constructor() {
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
   * @returns {vscode.TreeItem}
   */
  getTreeItem(element) {
    return element
  }

  /**
   * Get children for a given element
   * @param {*} element - Parent element (null for root)
   * @returns {vscode.TreeItem[]}
   */
  getChildren(element) {
    if (element) {
      return []
    }

    // Return operation items
    return [
      new OperationTreeItem(
        'Share Selection',
        'Share selected text to PastePortal',
        'pasteportal.store-paste',
        new vscode.ThemeIcon('cloud-upload')
      ),
      new OperationTreeItem(
        'Share Selection (Encrypted)',
        'Share selected text with password protection',
        'pasteportal.store-encrypted-paste',
        new vscode.ThemeIcon('lock')
      ),
      new OperationTreeItem(
        'Get Paste',
        'Retrieve paste by ID',
        'pasteportal.get-paste',
        new vscode.ThemeIcon('cloud-download')
      ),
      new OperationTreeItem(
        'Get Encrypted Paste',
        'Retrieve password-protected paste',
        'pasteportal.get-encrypted-paste',
        new vscode.ThemeIcon('key')
      ),
      new OperationTreeItem(
        'Open PastePortal',
        'Open PastePortal in browser',
        'pasteportal.openInBrowser',
        new vscode.ThemeIcon('globe')
      )
    ]
  }
}

/**
 * Operation Tree Item
 */
class OperationTreeItem extends vscode.TreeItem {
  constructor(label, tooltip, command, icon) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.tooltip = tooltip
    this.iconPath = icon
    this.command = {
      command: command,
      title: label
    }
    this.contextValue = 'operation'
  }
}

module.exports = OperationsTreeProvider

