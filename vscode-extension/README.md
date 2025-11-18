# PastePortal VS Code Extension

A Visual Studio Code extension for sharing and retrieving text snippets with PastePortal - a secure paste service for developers.

## Features

- **Share Text**: Share selected text or entire files to PastePortal
- **Retrieve Pastes**: Get pastes by ID directly into your editor
- **Password Protection**: Create and retrieve password-encrypted pastes
- **Authentication**: Sign in to manage your pastes
- **My Pastes**: View and manage your pastes in the sidebar
- **Recent Pastes**: Quick access to recently used pastes
- **Syntax Highlighting**: Preserve code formatting when sharing

## Requirements

- VS Code 1.74.0 or higher
- Internet connection to access PastePortal API

## Installation

1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "PastePortal"
4. Click Install

## Configuration

The extension works out-of-the-box with production PastePortal. Configure the extension in VS Code settings only if you need to customize:

- `pasteportal.serverUrl`: Server URL (base URL). API endpoint will be derived as `${serverUrl}/api` (default: http://localhost:3000)
- `pasteportal.apiEndpoint`: API endpoint URL (overrides serverUrl if explicitly set, default: https://pasteportal.app/api)
- `pasteportal.domain`: Domain URL (default: https://pasteportal.app)
- `pasteportal.supabase.url`: Supabase project URL (defaults to production PastePortal instance, override for self-hosting)
- `pasteportal.supabase.anonKey`: Supabase anonymous key (defaults to production PastePortal instance, override for self-hosting)

**Note:** Supabase settings are pre-configured with production defaults. You only need to change these if you're self-hosting PastePortal.

## Usage

### Share Selection

1. Select text in the editor
2. Right-click and choose "Share Selection to PastePortal"
3. Or use Command Palette: "PastePortal: Share Selection to PastePortal"

### Get Paste

1. Use Command Palette: "PastePortal: Get Paste from PastePortal"
2. Enter the paste ID or URL
3. Paste content will be inserted at cursor position

### Authentication

1. Open the "My Pastes" view in the sidebar
2. Click "Sign In" to authenticate
3. Once signed in, view and manage your pastes

## Commands

- `PastePortal: Share Selection to PastePortal` - Share selected text
- `PastePortal: Share File to PastePortal` - Share entire file
- `PastePortal: Get Paste from PastePortal` - Retrieve paste by ID
- `PastePortal: Get Encrypted Paste from PastePortal` - Retrieve password-protected paste
- `PastePortal: Sign In` - Authenticate with PastePortal
- `PastePortal: Sign Out` - Sign out
- `PastePortal: Refresh My Pastes` - Refresh paste list

## Development

### Setup

1. Install dependencies:
```bash
npm install
```

### Testing the Extension

**Important:** VS Code extensions cannot be run directly with Node.js. They must run inside VS Code's extension host.

To test and debug the extension:

1. Open this folder in VS Code
2. Press `F5` to launch a new Extension Development Host window
3. In the new window, you can test all extension features
4. Use the Debug Console in the original VS Code window to see logs

Alternatively:
- Go to Run and Debug view (Ctrl+Shift+D / Cmd+Shift+D)
- Select "Run Extension" from the dropdown
- Click the green play button or press F5

### Packaging

To create a `.vsix` package for distribution:

```bash
npm run package
```

This requires the `@vscode/vsce` package (install globally with `npm install -g @vscode/vsce`).

## License

GPL-3.0

## Repository

https://github.com/stiliajohny/pasteportal
