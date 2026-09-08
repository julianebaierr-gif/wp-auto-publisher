# WordPress AI Auto-Publisher & Yoast SEO Automation Tool
Target Website: `https://tradingblogco.com`

An autonomous publishing tool built with Next.js, OpenAI (`gpt-4o` & `dall-e-3`), and WordPress REST API. It automatically generates 1200+ word trading articles, creates 2 contextual AI images, performs automatic internal linking to your existing published posts, optimizes for 100% Yoast SEO scores, and publishes directly to your WordPress site.

---

## Features
- **100% Yoast SEO Compliance**: Keyword in title, slug, first 100 words, subheadings (H2/H3), image alt text, and meta description.
- **Auto-Internal Linking**: Scans your live website (`tradingblogco.com/wp-json/wp/v2/posts`) and naturally places contextual hyperlinks with descriptive anchor text.
- **2 AI Generated Images per Post**:
  - 1 Featured Hero Thumbnail (`1792x1024`) uploaded to WordPress media library.
  - 1 In-Article Technical Chart / Diagram (`1024x1024`) embedded in the middle of the article.
- **Bulk Queue Processing**: Run multiple articles one-after-another with real-time status tracking.
- **Direct Live or Draft Mode**: Publish immediately live or save as draft for preview.
- **Ready for GitHub & Vercel**: 100% cloud deployment ready with zero server maintenance.

---

## 1. WordPress Setup (Application Password)
To allow the tool to publish articles and upload images without sharing your main password:
1. Log in to your WordPress Admin (`https://tradingblogco.com/wp-admin`).
2. Go to **Users** -> **Profile** (or **All Users** -> Edit your user).
3. Scroll down to the **Application Passwords** section.
4. Enter a name: `AutoPublisher` and click **Add New Application Password**.
5. Copy the generated 24-character password (e.g. `abcd efgh ijkl mnop qrst uvwx`).

---

## 2. Running Locally

1. Open terminal inside the project folder:
   ```bash
   cd wp-auto-publisher
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your OpenAI Paid Key and WordPress details (or simply use the tool's built-in Settings UI).

3. Start development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

---

## 3. How to Push to GitHub

1. In the project folder, run:
   ```bash
   git add .
   git commit -m "Initial commit: WordPress Auto Publisher tool"
   ```

2. Create a new empty repository on [GitHub](https://github.com/new) (e.g., `wp-auto-publisher`).

3. Link and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/wp-auto-publisher.git
   git branch -M main
   git push -u origin main
   ```

---

## 4. Deploying to Vercel (1-Click)

1. Go to [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
2. Select your `wp-auto-publisher` GitHub repository.
3. Under **Environment Variables**, add:
   - `OPENAI_API_KEY`: Your OpenAI API key (`sk-...`).
   - `WORDPRESS_URL`: `https://tradingblogco.com`
   - `WORDPRESS_USERNAME`: Your WordPress username.
   - `WORDPRESS_APP_PASSWORD`: The 24-character application password.
   - `WORDPRESS_DEFAULT_STATUS`: `publish`
4. Click **Deploy**.
5. Your tool will be live at `https://your-project.vercel.app`!

