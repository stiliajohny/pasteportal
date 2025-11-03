# Google Search Console Setup Guide

This guide walks you through setting up Google Search Console for PastePortal to ensure your site is properly indexed by Google.

## Prerequisites

- Your site must be live and accessible via HTTPS
- You should have access to your domain's DNS settings (for DNS verification)
- A Google account

## Step 1: Add Your Property to Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click "Add Property"
3. Choose property type:
   - **Domain Property** (recommended): Covers all subdomains and protocols (e.g., `pasteportal.app`)
   - **URL Prefix Property**: Specific to a URL (e.g., `https://pasteportal.app`)

## Step 2: Verify Ownership

Google provides multiple verification methods. Choose the one that works best for you:

### Option A: HTML Tag Verification (Easiest)

1. In Google Search Console, select "HTML tag" verification method
2. Copy the `content` value from the meta tag (it will look like: `content="abc123xyz789"`)
3. Set the environment variable in your deployment platform:
   ```bash
   GOOGLE_VERIFICATION_TOKEN=abc123xyz789
   ```
4. The meta tag will automatically be added to your site's `<head>` via `layout.tsx`
5. Click "Verify" in Google Search Console

### Option B: HTML File Upload

1. In Google Search Console, select "HTML file upload" verification method
2. Download the verification file (e.g., `google1234567890abcdef.html`)
3. Upload it to `next-app/public/` directory
4. Deploy your site
5. Verify the file is accessible at: `https://pasteportal.app/google1234567890abcdef.html`
6. Click "Verify" in Google Search Console

### Option C: DNS Verification (Most Reliable)

1. In Google Search Console, select "Domain name provider" verification method
2. Add the TXT record to your domain's DNS settings:
   - **Type**: TXT
   - **Name**: `@` or your domain name
   - **Value**: The verification string provided by Google
3. Wait for DNS propagation (can take a few minutes to 48 hours)
4. Click "Verify" in Google Search Console

## Step 3: Submit Your Sitemap

1. After verification, go to "Sitemaps" in the left sidebar
2. Enter your sitemap URL: `https://pasteportal.app/sitemap.xml`
3. Click "Submit"
4. Google will start crawling your sitemap

## Step 4: Request Indexing for Important Pages

1. Use the "URL Inspection" tool in Search Console
2. Enter URLs you want indexed:
   - `https://pasteportal.app/`
   - `https://pasteportal.app/portal-docs`
   - `https://pasteportal.app/privacy`
   - `https://pasteportal.app/terms`
   - `https://pasteportal.app/security`
3. Click "Request Indexing" for each URL

## Step 5: Monitor Your Site

- **Coverage**: Check which pages are indexed
- **Performance**: Monitor search performance and impressions
- **Enhancements**: Review any structured data issues
- **Mobile Usability**: Ensure your site is mobile-friendly

## What's Already Configured

The following SEO optimizations are already in place:

✅ **robots.txt** - Located at `/robots.txt`, guides search engine crawlers
✅ **Sitemap** - Dynamic sitemap at `/sitemap.xml` with all public pages
✅ **Structured Data** - JSON-LD schema markup for better search results
✅ **Canonical URLs** - Prevents duplicate content issues
✅ **Meta Tags** - Open Graph and Twitter Card tags for social sharing
✅ **Page Metadata** - Unique titles and descriptions for each page

## Pages Indexed

The following public pages are configured for indexing:
- `/` - Homepage
- `/portal-docs` - API Documentation
- `/privacy` - Privacy Policy
- `/terms` - Terms and Conditions
- `/security` - Security Information

The following pages are **excluded** from indexing:
- `/auth/*` - Authentication pages
- `/my-pastes` - User-specific content
- `/settings` - User settings
- `/api/*` - API endpoints

## Troubleshooting

### Verification Fails

- **HTML Tag**: Ensure `GOOGLE_VERIFICATION_TOKEN` environment variable is set correctly
- **HTML File**: Verify the file is accessible at the exact URL specified
- **DNS**: Check DNS propagation using tools like `dig` or online DNS checkers

### Pages Not Indexed

- Ensure pages return HTTP 200 status
- Check that pages aren't blocked by `robots.txt`
- Verify pages have unique, descriptive content
- Use URL Inspection tool to see specific issues

### Sitemap Issues

- Verify sitemap is accessible at `/sitemap.xml`
- Check that all URLs in sitemap are accessible
- Ensure URLs use HTTPS

## Additional Resources

- [Google Search Console Help](https://support.google.com/webmasters)
- [Google Search Central Documentation](https://developers.google.com/search)
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

## Environment Variables

Add to your `.env` or deployment platform:

```bash
# Your site URL (should match your domain)
NEXT_PUBLIC_SITE_URL=https://pasteportal.app

# Google Search Console verification token (optional, for HTML tag method)
GOOGLE_VERIFICATION_TOKEN=your_verification_token_here
```

