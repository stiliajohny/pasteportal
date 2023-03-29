const vscode = require('vscode')
const axios = require('axios')
const crypto = require('crypto')

axios.defaults.headers.common['x-api-key'] =
  'qVP1XsKWJF2vud7zo1jzS6BQ22xy4xXH4DY634py'
const api_endpoint = 'https://api.pasteportal.info'
const tos_link =
  '[Terms of Service](https://github.com/stiliajohny/pasteportal/blob/master/vscode-extension/TOS.md)'
const passwordLengthMin = 8
const passwordLengthMax = 30

function encrypt(password, text) {
  /**
   * Encrypt the text using the password
   * @param {string} password
   * @param {string} text
   * @returns {string}
   * @throws {TypeError}
   * @throws {Error}
   */
  try {
    if (typeof password !== 'string') {
      throw new TypeError('Password must be a string')
    }
    if (typeof text !== 'string') throw new TypeError('Text must be a string')
    if (!password) throw new Error('No password provided')
    if (password.length < passwordLengthMin) {
      throw new Error('Password should be at least 8 characters long.')
    }
    if (password.length > passwordLengthMax) {
      throw new Error('Password should be less than 30 characters long.')
    }
    if (password.includes(' ')) {
      throw new Error('Password should not contain spaces.')
    }
    if (password.includes('\t')) {
      throw new Error('Password should not contain tabs.')
    }
    if (password.includes('\n')) {
      throw new Error('Password should not contain new lines.')
    }
    if (password.includes('\r')) {
      throw new Error('Password should not contain carriage returns.')
    }
    if (password.includes('\v')) {
      throw new Error('Password should not contain vertical tabs.')
    }
    if (password.includes('\f')) {
      throw new Error('Password should not contain form feeds.')
    }
    if (password.includes('\0')) {
      throw new Error('Password should not contain null characters.')
    }

    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(password, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + encrypted
  } catch (error) {
    vscode.window.showErrorMessage(error)
    throw error
  }
}

function decrypt(password, encryptedText) {
  /**
   * Decrypt the text using the password
   * @param {string} password
   * @param {string} encryptedText
   * @returns {string}
   * @throws {TypeError}
   * @throws {Error}
   */

  try {
    if (typeof password !== 'string') {
      throw new TypeError('Password must be a string')
    }
    if (!password) throw new Error('No password provided')
    if (password.length < passwordLengthMin) {
      throw new Error('Password should be at least 8 characters long.')
    }
    if (password.length > passwordLengthMax) {
      throw new Error('Password should be less than 30 characters long.')
    }
    if (password.includes(' ')) {
      throw new Error('Password should not contain spaces.')
    }
    if (password.includes('\t')) {
      throw new Error('Password should not contain tabs.')
    }
    if (password.includes('\n')) {
      throw new Error('Password should not contain new lines.')
    }
    if (password.includes('\r')) {
      throw new Error('Password should not contain carriage returns.')
    }
    if (password.includes('\v')) {
      throw new Error('Password should not contain vertical tabs.')
    }
    if (password.includes('\f')) {
      throw new Error('Password should not contain form feeds.')
    }
    if (password.includes('\0')) {
      throw new Error('Password should not contain null characters.')
    }
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(password, 'salt', 32)
    const iv = Buffer.from(encryptedText.slice(0, 32), 'hex')
    const encrypted = encryptedText.slice(32)
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    vscode.window.showErrorMessage(error)
    console.error(error)
    throw error
  }
}

function getPasteId(text) {
  /**
   * Get the paste id from the text
   * @param {string} text
   * @returns {string}
   * @throws {TypeError}
   * @throws {Error}
   * @throws {null}
   * @throws {string}
   *
   * @example
   * getPasteId('http://pasteportal.info/?id=123456') // returns '123456'
   * getPasteId('123456') // returns '123456'
   */
  try {
    if (typeof text !== 'string' || !text) {

      throw new Error('Input must be a non-empty string.')
    }

    const idRegex =
      /^(?:http:\/\/|https:\/\/)pasteportal\.info\/?\?id=([a-fA-F0-9]{6})$/
    const match = text.match(idRegex)

    if (match) {
      return match[1]
    } else if (/^[a-fA-F0-9]{6}$/.test(text)) {
      return text
    } else {
      throw new Error('Invalid id or URL format')
    }
  } catch (error) {
    return null
  }
}

function multiLineClipboard(id, password) {
  /**
   * Create a multiline string to be copied to clipboard
   * @param {string} id
   * @param {string} password
   * @returns {string}
   * @throws {TypeError}
   * @throws {Error}
   */
  try {
    if (typeof id !== 'string') throw new TypeError('Text must be a string')
    if (id.length < 1) throw new Error('Text cannot be empty')

    // if password is provided then create a multiline string to explain how to get the text
    // if password is not provided then create a multiline string to explain how to get the text

    if (password) {
      if (typeof password !== 'string') {
        throw new TypeError('Password must be a string')
      }
      if (password.length < passwordLengthMin) {
        throw new Error('Password cannot be empty')
      }
      const clipText = `To get the paste, go to https://pasteportal.info/?id=${id} and enter the password ${password}\nYou can also use the VSCode command "Paste Portal: Get Encypted Text" to get the paste.\nUse the URL https://pasteportal.info/?id=${id} and password ${password} to get the paste.`
      return clipText
    } else {
      const clipText = `To get the paste, go to https://pasteportal.info/?id=${id}\nYou can also use paste VSCode command "Paste Portal: Get Text" to get the text.\nUse the URL https://pasteportal.info/?id=${id} to get the paste.`
      return clipText
    }
  } catch (error) {
    vscode.window.showErrorMessage(error)
    console.error(error)
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

function activate(context) {
  /**
   * This method is called when your extension is activated.
   * Your extension is activated the very first time the command is executed.
   *
   * @param {vscode.ExtensionContext} context
   *
   */
  console.log('Congratulations, your extension "pasteportal" is now active!')

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
          prompt: 'Enter the paste ID. eg. 43e4c2'
        })
        console.log('Prompt: ', prompt)

        // get the paste ID from the user
        const pasteId = getPasteId(prompt)
        console.log('Paste ID: ', pasteId)

        if (!pasteId) throw new Error('Paste ID/URL cannot be empty')
        console.log('Paste ID/URL is empty')

        const baseURL = `${api_endpoint}/get-paste?id=${pasteId}`
        axios
          .get(baseURL)
          .then(async function (response) {
            const {
              response: {
                joke,
                id,
                paste,
                creator_gh_user,
                recipient_gh_username
              }
            } = response.data
            console.log('Joke: :' + joke)
            console.log('ID: :' + id)
            console.log('Paste: :' + paste)
            console.log('Creator: :' + creator_gh_user)
            console.log('Recipient: :' + recipient_gh_username)

            // insert the paste content into the active editor
            editor.edit((editBuilder) => {
              editBuilder.insert(editor.selection.active, paste)
            })
            console.log('Paste retrieved successfully')
            vscode.window.showInformationMessage(
              'Paste retrieved successfully.'
            )
          })
          .catch(function (error) {
            console.log(error)
            vscode.window.showErrorMessage(
              `Things gone haywire:\n ${error.message}`
            )
          })
      } catch (error) {
        console.log(error)
        vscode.window.showErrorMessage(
          `Things gone haywire:\n ${error.message}`
        )
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
        // post the selected text to the API
        const baseURL = `${api_endpoint}/store-paste`
        const { data } = await axios.post(baseURL, {
          paste: selectedText,
          recipient_gh_username: 'unknown', // TODO get the username from the user
          creator_gh_user: 'unknown' // TODO get the username from the user
        })

        console.log('Paste stored to the API')
        const { joke, id, paste, creator_gh_user, recipient_gh_username } =
          data.response
        console.log('Joke: :' + joke)
        console.log('ID: :' + id)
        console.log('Paste: :' + paste)
        console.log('Creator: :' + creator_gh_user)
        console.log('Recipient: :' + recipient_gh_username)
        vscode.window.showInformationMessage(
          'Instructions copied to clipboard'
        )
        vscode.env.clipboard.writeText(multiLineClipboard(id))
        console.log('Instructions copied to clipboard')
        console.log(multiLineClipboard(id))
      } catch (error) {
        console.log(error)
        vscode.window.showErrorMessage(
          `Things gone haywire:\n ${error.message}`
        )
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

      const prompt = await vscode.window.showInputBox({
        prompt: 'Enter the paste ID/URL'
      })

      if (!prompt) throw new Error('No paste ID/URL provided')
      console.log('Prompt: ', prompt)

      const pasteId = getPasteId(prompt)
      console.log('Paste ID: ', pasteId)

      // ask for the password
      const password = await vscode.window.showInputBox({
        prompt: 'Enter the password. eg. password12345'
      })
      const baseURL = `${api_endpoint}/get-paste?id=${pasteId}`
      axios
        .get(baseURL)
        .then(async function (response) {
          const {
            response: {
              joke,
              id,
              paste,
              creator_gh_user,
              recipient_gh_username
            }
          } = response.data
          console.log('Joke: :' + joke)
          console.log('ID: :' + id)
          console.log('Paste: :' + paste)
          console.log('Creator: :' + creator_gh_user)
          console.log('Recipient: :' + recipient_gh_username)

          console.log('Paste: :' + paste)

          // Decrypt the text
          const decryptedText = decrypt(password, paste)
          console.log('Decrypted text: ', decryptedText)

          // insert the paste content into the active editor
          editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, decryptedText)
          })
          console.log('Paste retrieved successfully')
          vscode.window.showInformationMessage('Paste retrieved successfully.')
        })
        .catch(function (error) {
          console.log(error)
          vscode.window.showErrorMessage(
            `Things gone haywire:\n ${error.message}`
          )
        })
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
        // get the password from the user to encrypt the paste
        const password = await vscode.window.showInputBox({
          prompt: 'Enter the password to encrypt the paste',
          password: true,
          placeHolder: 'password12345'
        })
        const encryptedPaste = encrypt(password, selectedText)
        console.log('Selected text encrypted successfully')
        console.log('Encrypted text: ', encryptedPaste)

        // post the selected text to the API
        const baseURL = `${api_endpoint}/store-paste`
        const { data } = await axios.post(baseURL, {
          paste: encryptedPaste,
          recipient_gh_username: 'unknown', // TODO get the username from the user
          creator_gh_user: 'unknown' // TODO get the username from the user
        })

        console.log('Paste stored to the API')
        const { joke, id, paste, creator_gh_user, recipient_gh_username } =
          data.response
        console.log('Joke: :' + joke)
        console.log('ID: :' + id)
        console.log('Paste: :' + paste)
        console.log('Creator: :' + creator_gh_user)
        console.log('Recipient: :' + recipient_gh_username)
        vscode.window.showInformationMessage(
          'Instructions copied to clipboard'
        )
        vscode.env.clipboard.writeText(multiLineClipboard(id, password))
        console.log('Instructions copied to clipboard')
        console.log(multiLineClipboard(id, password))
      } catch (error) {
        console.log(error)
        vscode.window.showErrorMessage(
          `Things gone haywire:\n ${error.message}`
        )
      }
    }
  )

  context.subscriptions.push(get_paste)
  context.subscriptions.push(store_paste)
  context.subscriptions.push(get_encrypted_paste)
  context.subscriptions.push(store_encrypted_paste)
}


function deactivate() { }

module.exports = {
  activate,
  deactivate
}
