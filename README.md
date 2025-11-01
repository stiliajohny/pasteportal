[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![GPL3 License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]
[![Ask Me Anything][ask-me-anything]][personal-page]
<br>
[![DeepScan grade](https://deepscan.io/api/teams/20369/projects/23831/branches/728049/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=20369&pid=23831&bid=728049)
[![DeepSource](https://deepsource.io/gh/stiliajohny/pasteportal.svg/?label=active+issues&show_trend=true&token=F76XWAtTJtrlBz2eJT6wo8ym)](https://deepsource.io/gh/stiliajohny/pasteportal/?ref=repository-badge)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/af53234fa6cb427cbc96a8078d8daceb)](https://www.codacy.com/gh/stiliajohny/pasteportal/dashboard?utm_source=github.com&utm_medium=referral&utm_content=stiliajohny/pasteportal&utm_campaign=Badge_Grade)

<!-- PROJECT LOGO -->

<br/>
<p align="center">
  <a href="https://github.com/stiliajohny/pasteportal">
    <img src="https://raw.githubusercontent.com/stiliajohny/pasteportal/master/.assets/icon_revised/png/__256.png" alt="Main Logo" width="80" height="80">
  </a>

  <h3 align="center">PastePortal</h3>

  <p align="center">
A text sharing tool for developers
    <br />
    <a href="https://pasteportal.app">Frontend</a>
    ·
    <a href="https://marketplace.visualstudio.com/items?itemName=JohnStilia.pasteportal">VSCode Extension</a>
    </br>
    <a href="https://github.com/stiliajohny/pasteportal/issues/new?labels=i%3A+bug&template=1-bug-report.md">Report Bug</a>
    ·
    <a href="https://github.com/stiliajohny/pasteportal/issues/new?labels=i%3A+enhancement&template=2-feature-request.md">Request Feature</a>

  </p>
</p>

<!-- TABLE OF CONTENTS -->

## Table of Contents

- [Table of Contents](#table-of-contents)
- [About The Project](#about-the-project)
  - [Built With](#built-with)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Supabase Setup](#supabase-setup)
- [Usage](#usage)
  - [Using the VSCode Extension](#using-the-vscode-extension)
  - [Using the Frontend](#using-the-frontend)
- [API Documentation](#api-documentation)
  - [Version 1 API](#version-1-api)
    - [POST `/api/v1/store-paste`](#post-apiv1store-paste)
    - [GET `/api/v1/get-paste?id=<paste-id>`](#get-apiv1get-pasteidpaste-id)
  - [Legacy API Endpoints](#legacy-api-endpoints)
- [Deployment](#deployment)
  - [Netlify Deployment](#netlify-deployment)
- [Security](#security)
  - [Encryption](#encryption)
  - [Best Practices](#best-practices)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgements](#acknowledgements)

<!-- ABOUT THE PROJECT -->

## About The Project

PastePortal is a revolutionary new application that makes sharing text a breeze. Designed with developers in mind, PastePortal eliminates the need for the traditional copy-paste method, making it easy to share context without any additional complexity.

The application comes with a VSCode extension, as well as, a frontend, making it accessible to a wide range of users.
Whether you're working on a large project with multiple team members or simply need to share a small snippet of code, PastePortal is the perfect solution.
With its user-friendly interface and powerful functionality, it's no wonder why PastePortal is quickly becoming the go-to choice for developers everywhere.

Try it out today and see the difference for yourself!

### Built With

- [Next.js](https://nextjs.org/) - React framework for production
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Supabase](https://supabase.com/) - Backend database
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [PWA](https://web.dev/progressive-web-apps/) - Progressive Web App support

---

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Supabase account (SaaS)
- Git

### Installation

1. Clone the repository

```sh
git clone https://github.com/stiliajohny/pasteportal.git
cd pasteportal
```

2. Install dependencies

```sh
npm install
```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Run Supabase migrations (see [Supabase Setup](#supabase-setup))

5. Start the development server

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

**Important Notes:**

- `ENCRYPTION_KEY`: Must be a secure random 32-byte key (64 hex characters) or any string that will be used to derive a 32-byte key using scrypt
- Keep your encryption key secure and never commit it to version control
- For production, use a secure method to generate and store the encryption key

### Supabase Setup

1. **Create a Supabase project** (if you haven't already) at [supabase.com](https://supabase.com)

2. **Run migrations** to set up the database schema:

```sh
# Using Supabase CLI (recommended)
supabase db push

# Or manually run the SQL migration file:
# supabase/migrations/001_initial_schema.sql
```

3. **Verify the table was created:**

The migration creates a `pastes` table with the following structure:

- `id` (TEXT, primary key, 6-character hex)
- `paste` (TEXT, encrypted content)
- `recipient_gh_username` (TEXT)
- `timestamp` (TIMESTAMP)
- `created_at` (TIMESTAMP)

The table includes Row Level Security (RLS) policies for public read/write access.

## Usage

### Using the VSCode Extension

The VSCode extension is available on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=JohnStilia.pasteportal).

After installing the extension, you can use the command `PastePortal: Share` to share the current selection.

In order to retrieve the content of a paste, you can use the command `PastePortal: Retrieve` and enter the paste id.

### Using the Frontend

The frontend is available at [https://pasteportal.app](https://pasteportal.app).

You can:

- View pastes by visiting `https://pasteportal.app?id=<paste-id>`
- Manually retrieve pastes using the sidebar "Get Paste" option
- Install as a PWA for offline access

## API Documentation

### Version 1 API

#### POST `/api/v1/store-paste`

Store a new paste.

**Request Body:**

```json
{
  "paste": "Your text content here",
  "recipient_gh_username": "recipient"
}
```

**Response:**

```json
{
  "response": {
    "message": "The paste was successfully inserted into the database",
    "id": "abc123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "paste": "Your text content here",
    "joke": "A random programming joke"
  }
}
```

#### GET `/api/v1/get-paste?id=<paste-id>`

Retrieve a paste by ID.

**Response:**

```json
{
  "response": {
    "message": "The paste was successfully retrieved from the database",
    "id": "abc123",
    "paste": "Your text content here",
    "recipient_gh_username": "recipient",
    "joke": "A random programming joke"
  }
}
```

### Legacy API Endpoints

For backward compatibility with the VSCode extension, the following legacy endpoints are available:

- `/api/store-paste` → redirects to `/api/v1/store-paste`
- `/api/get-paste` → redirects to `/api/v1/get-paste`

## Deployment

### Netlify Deployment

The application is configured for deployment on Netlify:

1. **Connect your repository** to Netlify

2. **Set environment variables** in Netlify dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ENCRYPTION_KEY`

3. **Configure custom domain** `pasteportal.app` in Netlify dashboard

4. **Deploy** - Netlify will automatically build and deploy using the `netlify.toml` configuration

The `netlify.toml` file includes:

- Build settings
- API route redirects
- PWA headers
- Security headers

## Security

### Encryption

- All paste content is encrypted using **AES-256-GCM** before storing in the database
- Encryption key is stored in environment variables and never exposed to clients
- Encryption/decryption happens server-side only

### Best Practices

- Always use a strong, randomly generated encryption key
- Never commit `.env.local` or encryption keys to version control
- Use environment variables for all sensitive configuration
- Regularly rotate encryption keys in production

## Roadmap

See the [open issues](https://github.com/stiliajohny/pasteportal/issues) for a list of proposed features (and known issues).

---

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the GPLv3 License. See `LICENSE` for more information.

## Contact

John Stilia - <stilia.johny@gmail.com>

---

## Acknowledgements

- [Danut](https://github.com/DanutEne)
- [Ahley](https://github.com/cur50r)
- [GitHub Emoji Cheat Sheet](https://www.webpagefx.com/tools/emoji-cheat-sheet)
- [Img Shields](https://shields.io)
- [Choose an Open Source License](https://choosealicense.com)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/stiliajohny/pasteportal.svg
[contributors-url]: https://github.com/stiliajohny/pasteportal/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/stiliajohny/pasteportal.svg
[forks-url]: https://github.com/stiliajohny/pasteportal/network/members
[stars-shield]: https://img.shields.io/github/stars/stiliajohny/pasteportal.svg
[stars-url]: https://github.com/stiliajohny/pasteportal/stargazers
[issues-shield]: https://img.shields.io/github/issues/stiliajohny/pasteportal.svg
[issues-url]: https://github.com/stiliajohny/pasteportal/issues
[license-shield]: https://img.shields.io/github/license/stiliajohny/pasteportal
[license-url]: https://github.com/stiliajohny/pasteportal/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg
[linkedin-url]: https://linkedin.com/in/
[ask-me-anything]: https://img.shields.io/badge/Ask%20me-anything-1abc9c.svg
[personal-page]: https://github.com/stiliajohny
