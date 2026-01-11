import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POSTS_FILE = join(__dirname, '../data/posts.json');

interface Post {
  id: string;
  content: string;
  timestamp: string;
  category?: 'update' | 'thought';
  curated?: boolean;
}

interface PostsData {
  profile: {
    name: string;
    handle: string;
    bio: string;
  };
  posts: Post[];
}

// Thread detection: posts within 5 minutes are likely a thread
const THREAD_THRESHOLD_MS = 5 * 60 * 1000;

// Minimum content length to be considered a "thought" thread worth merging
const MIN_THOUGHT_LENGTH = 100;

function detectThreads(posts: Post[]): Post[][] {
  // Sort by timestamp ascending
  const sorted = [...posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const threads: Post[][] = [];
  let currentThread: Post[] = [];

  for (const post of sorted) {
    if (currentThread.length === 0) {
      currentThread.push(post);
      continue;
    }

    const lastPost = currentThread[currentThread.length - 1];
    const timeDiff =
      new Date(post.timestamp).getTime() - new Date(lastPost.timestamp).getTime();

    // Check if this post is part of the current thread
    if (timeDiff <= THREAD_THRESHOLD_MS) {
      // Additional heuristic: both should be thoughts or have substantial content
      const lastIsThought = lastPost.category === 'thought' || lastPost.content.length > MIN_THOUGHT_LENGTH;
      const currentIsThought = post.category === 'thought' || post.content.length > MIN_THOUGHT_LENGTH;

      // Merge if both are thoughts/substantial OR if very close in time (< 2 min)
      if ((lastIsThought && currentIsThought) || timeDiff <= 2 * 60 * 1000) {
        currentThread.push(post);
      } else {
        threads.push(currentThread);
        currentThread = [post];
      }
    } else {
      threads.push(currentThread);
      currentThread = [post];
    }
  }

  if (currentThread.length > 0) {
    threads.push(currentThread);
  }

  return threads;
}

function mergeThread(posts: Post[]): Post {
  // Sort by timestamp ascending (reading order)
  const sorted = [...posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Combine content with double line breaks
  const combinedContent = sorted.map((p) => p.content).join('\n\n');

  // Use first post's timestamp (when thread started)
  const timestamp = sorted[0].timestamp;

  // Use first post's ID with -thread suffix
  const id = sorted[0].id;

  // If any is curated, mark as curated
  const curated = sorted.some((p) => p.curated);

  // If any is thought, mark as thought
  const category = sorted.some((p) => p.category === 'thought') ? 'thought' : 'update';

  return {
    id,
    content: combinedContent,
    timestamp,
    category,
    curated,
  };
}

function main() {
  console.log('Loading posts...');
  const data: PostsData = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  const originalCount = data.posts.length;

  console.log(`Found ${originalCount} posts`);
  console.log('Detecting threads...');

  const threads = detectThreads(data.posts);
  const multiPostThreads = threads.filter((t) => t.length > 1);

  console.log(`Found ${multiPostThreads.length} threads to merge`);

  // Show what will be merged
  multiPostThreads.forEach((thread, idx) => {
    console.log(`\nThread ${idx + 1} (${thread.length} posts):`);
    thread.forEach((p, i) => {
      const preview = p.content.length > 60 ? p.content.slice(0, 60) + '...' : p.content;
      console.log(`  [${i + 1}] ${preview}`);
    });
  });

  // Merge threads
  const mergedPosts = threads.map((thread) =>
    thread.length > 1 ? mergeThread(thread) : thread[0]
  );

  // Sort by timestamp descending (newest first)
  mergedPosts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  console.log(`\nMerged ${multiPostThreads.length} threads`);
  console.log(`Post count: ${originalCount} → ${mergedPosts.length}`);

  data.posts = mergedPosts;
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  console.log('Saved to posts.json');
}

main();
