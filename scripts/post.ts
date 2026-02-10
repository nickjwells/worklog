import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POSTS_FILE = join(__dirname, '../data/posts.json');

interface Post {
  id: string;
  content: string;
  timestamp: string;
}

interface PostsData {
  profile: {
    name: string;
    handle: string;
    bio: string;
  };
  posts: Post[];
}

function loadData(): PostsData {
  const raw = readFileSync(POSTS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function saveData(data: PostsData): void {
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2) + '\n');
}

function addPost(content: string): void {
  const data = loadData();

  const trimmed = content.trim();
  const ending = trimmed.slice(-1);
  const needsPeriod = ending !== '.' && ending !== '!' && ending !== '?' && ending !== '"' && ending !== ')';
  const finalContent = needsPeriod ? trimmed + '.' : trimmed;

  const newPost: Post = {
    id: `post-${randomUUID().slice(0, 8)}`,
    content: finalContent,
    timestamp: new Date().toISOString(),
  };

  // Prepend new post (newest first)
  data.posts.unshift(newPost);
  saveData(data);

  console.log(`\n  Posted: "${content}"\n`);
}

function listPosts(count: number = 5): void {
  const data = loadData();
  const recentPosts = data.posts.slice(0, count);

  console.log(`\n  Recent updates:\n`);
  recentPosts.forEach((post, i) => {
    const date = new Date(post.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    console.log(`  ${i + 1}. [${date}] ${post.content}`);
  });
  console.log();
}

function showHelp(): void {
  console.log(`
  Worklog CLI

  Usage:
    npm run post "Your update here"     Add a new post
    npm run post --list                 Show recent posts
    npm run post --help                 Show this help

  Examples:
    npm run post "Recorded 7 roasts for Maker School."
    npm run post "Shipped new feature."
`);
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else if (args.includes('--list') || args.includes('-l')) {
  listPosts();
} else if (args.length > 0 && !args[0].startsWith('--')) {
  const content = args.join(' ');
  addPost(content);
} else {
  showHelp();
}
