# Worklog

A minimalistic, Apple-inspired personal micro-blogging app for work log updates. No algorithms, no distractions.

## Quick Start

```bash
npm run dev      # Start dev server (http://localhost:4321)
npm run build    # Build for production
npm run preview  # Preview production build
```

## Adding Posts via Claude

When the user says `update:` or `thought:` followed by content, add it to `data/posts.json`:

```typescript
// Example: User says "update: Shipped new feature"
{
  "id": `post-${Date.now()}`,
  "content": "Shipped new feature",
  "timestamp": new Date().toISOString(),
  "category": "update",
  "curated": false
}

// Example: User says "thought: Interesting observation about productivity"
{
  "id": `post-${Date.now()}`,
  "content": "Interesting observation about productivity",
  "timestamp": new Date().toISOString(),
  "category": "thought",
  "curated": false  // Set true if it's a notable/profound insight
}
```

Add the new post to the **beginning** of the `posts` array in `data/posts.json`.

**After adding the post, always commit and push to deploy:**
```bash
git add data/posts.json && git commit -m "Add post" && git push
```

The site will show the new post instantly by fetching the latest data from GitHub (before the static rebuild completes).

### Via CLI
```bash
npm run post "Your update here"
npm run post -- --list  # List recent posts
```

## Tech Stack

- **Framework**: Astro v5
- **Styling**: Tailwind CSS v4
- **Font**: System font stack (SF Pro, Inter)
- **Storage**: JSON file (`data/posts.json`)
- **Screenshots**: Puppeteer

## Project Structure

```
/Users/nicksaraev/Worklog/
├── data/
│   └── posts.json              # All posts + profile data
├── public/
│   └── avatar.jpg              # Profile picture (from YouTube)
├── src/
│   ├── components/
│   │   ├── Post.astro          # Individual post with category label + auto-linking
│   │   └── ProfileCard.astro   # Profile header with stats + revenue
│   ├── layouts/
│   │   └── BaseLayout.astro    # HTML wrapper
│   ├── pages/
│   │   └── index.astro         # Main timeline with filters
│   └── styles/
│       └── global.css          # Tailwind imports
├── scripts/
│   ├── post.ts                 # CLI posting tool
│   ├── screenshot.ts           # Puppeteer screenshots
│   ├── categorize.ts           # Claude API categorization
│   ├── categorize-local.ts     # Pattern-based categorization
│   ├── smart-merge.ts          # Merge Twitter threads (narrative-based)
│   ├── merge-threads-opus.ts   # Merge threads with Opus 4.5 (needs API key)
│   └── rebuild-posts.ts        # Rebuild posts from Twitter backup
├── astro.config.mjs
├── tailwind.config.mjs
├── netlify.toml
└── package.json
```

## Data Schema

```json
{
  "profile": {
    "name": "Nick Saraev",
    "handle": "@nicksaraevwork",
    "bio": "Live streaming my daily work, my one-off shower thoughts, and anything & everything else. A no-algorithm alternative to X (after I deleted my social media)."
  },
  "posts": [
    {
      "id": "unique-id",
      "content": "Post content here",
      "timestamp": "2026-01-11T14:30:00Z",
      "category": "update",
      "curated": false
    }
  ]
}
```

### Post Categories
- **update**: Deliverables, task completions, work activities (e.g., "Completed X", "Recorded Y", "Shipped Z")
- **thought**: Reflections, ideas, opinions, observations (e.g., "Coming to the conclusion that...", "I think...", "All this to say...")

### Curated Flag
Set `curated: true` for high-quality thoughts worth revisiting - novel insights, strategic ideas, profound observations.

## Features

- **Revenue**: Monthly revenue displayed in stats (currently $335K)
- **Stats**: Post count, current streak, average posts per day
- **Filters**: All, Updates, Thoughts, Curated
- **Month Grouping**: Posts grouped by month (Apple newsroom style)
- **Categories**: Visual labels for update vs thought posts
- **Auto-linking**: URLs in posts automatically become clickable links
- **Thread Merging**: Twitter threads are combined into single posts

### Updating Revenue
Edit `src/pages/index.astro` line ~93:
```astro
revenue="$335K"
```

### Updating Profile Picture
Download new image to `public/avatar.jpg`. Current source: YouTube @nicksaraev

## Scripts

### Screenshots
```bash
npm run screenshot                     # Desktop (1200x800)
npm run screenshot -- --preset=mobile  # Mobile (390x844)
npm run screenshot -- --preset=tablet  # Tablet (820x1180)
npm run screenshot -- --all            # All presets
```
Screenshots saved to `/screenshots/`. Set `DEV_URL` env var if not on port 4321.

### Categorization
```bash
# With Claude API
ANTHROPIC_API_KEY=your-key npm run categorize

# Local pattern matching (no API needed)
npx ts-node --esm --project tsconfig.scripts.json scripts/categorize-local.ts
```

### Thread Merging
Merges Twitter threads based on narrative continuity patterns (not just time proximity):
```bash
npx ts-node --esm --project tsconfig.scripts.json scripts/smart-merge.ts
```

Only merges posts that:
1. Are within 5 minutes of each other
2. Have narrative continuity (e.g., "So I'm going to...", "All this to say...", "It'll be...")
3. Are both thoughts (never merges standalone updates like "Completed X" + "Recorded Y")

### Rebuild from Twitter Backup
If data is lost, rebuild from `/tmp/twitter-backup.json`:
```bash
npx ts-node --esm --project tsconfig.scripts.json scripts/rebuild-posts.ts
```

## Auto-Linking URLs

The `Post.astro` component automatically converts URLs to clickable links:
- Styled with Apple blue (#0071e3)
- Opens in new tab
- Handles trailing punctuation (parentheses, periods, etc.)

## Deployment

Configured for Netlify auto-deploy. Push to main branch to deploy.

```bash
git add .
git commit -m "Work log update"
git push
```

## Design System

Apple-inspired styling:
- Colors: `#1d1d1f` (text), `#86868b` (secondary), `#f5f5f7` (background), `#0071e3` (links)
- Font: System font stack with Inter fallback
- Max width: 672px (42rem), centered
- Generous whitespace, subtle borders

## Important Notes for Claude

1. **Dev server runs on port 4323** (4321 and 4322 may be in use)
2. **Posts are sorted newest-first** in the JSON file
3. **Never merge unrelated updates** - "Completed X" and "Recorded Y" are separate even if close in time
4. **Thread detection uses narrative patterns**, not just timestamps
5. **Revenue is hardcoded** in index.astro, not in posts.json
6. **Avatar is local** at `/public/avatar.jpg`, not a remote URL
