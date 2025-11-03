const vscode = require('vscode')

/**
 * Secure storage wrapper for VS Code secrets API
 * Provides secure token storage using VS Code's built-in keychain/credential store
 */
class SecureStorage {
  /**
   * Create a new SecureStorage instance
   * @param {vscode.SecretStorage} secretStorage - VS Code secret storage
   */
  constructor(secretStorage) {
    if (!secretStorage) {
      throw new Error('SecretStorage is required')
    }
    this.secretStorage = secretStorage
  }

  /**
   * Store a token securely
   * @param {string} key - Storage key
   * @param {string} value - Token value to store
   * @returns {Promise<void>}
   */
  async storeToken(key, value) {
    try {
      await this.secretStorage.store(key, value)
    } catch (error) {
      console.error(`Error storing token for key ${key}:`, error.message)
      throw error
    }
  }

  /**
   * Get a stored token
   * @param {string} key - Storage key
   * @returns {Promise<string|undefined>}
   */
  async getToken(key) {
    try {
      return await this.secretStorage.get(key)
    } catch (error) {
      console.error(`Error getting token for key ${key}:`, error.message)
      return undefined
    }
  }

  /**
   * Delete a stored token
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async deleteToken(key) {
    try {
      await this.secretStorage.delete(key)
    } catch (error) {
      console.error(`Error deleting token for key ${key}:`, error.message)
    }
  }

  /**
   * Clear multiple tokens
   * @param {string[]} keys - Array of storage keys to clear
   * @returns {Promise<void>}
   */
  async clearTokens(keys) {
    const promises = keys.map(key => this.deleteToken(key))
    await Promise.all(promises)
  }

  /**
   * Check if a token exists
   * @param {string} key - Storage key
   * @returns {Promise<boolean>}
   */
  async hasToken(key) {
    const token = await this.getToken(key)
    return token !== undefined && token !== null
  }
}

module.exports = SecureStorage

