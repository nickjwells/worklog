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
  profile: { name: string; handle: string; bio: string };
  posts: Post[];
}

// Thread continuation patterns - these indicate a post is continuing a previous thought
const CONTINUATION_PATTERNS = [
  /^so i'm going to/i,
  /^so i/i,
  /^it'll be/i,
  /^it will be/i,
  /^this means/i,
  /^this is/i,
  /^that's why/i,
  /^which means/i,
  /^all this to say/i,
  /^in other words/i,
  /^basically/i,
  /^anyway/i,
  /^also,/i,
  /^and /i,
  /^but /i,
  /^because /i,
  /^since /i,
  /^nvm,/i,
  /^fixed\./i,
  /^update:/i,
  /^cont'd/i,
  /^continued/i,
  /^\d+\./,  // Numbered lists like "1. ..."
  /^- /,     // Bullet points
];

// Patterns that indicate a standalone update (not part of a thread)
const STANDALONE_UPDATE_PATTERNS = [
  /^completed /i,
  /^recorded \d+ roasts/i,
  /^sent \d+ /i,
  /^hosted /i,
  /^crushed /i,
  /^gym/i,
  /^1:1 with/i,
  /^paid /i,
  /^reviewed /i,
  /^cancelled /i,
  /^purchased /i,
  /^leg day/i,
  /^chest day/i,
  /^back day/i,
  /^arm day/i,
];

const TIME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isStandaloneUpdate(content: string): boolean {
  return STANDALONE_UPDATE_PATTERNS.some(p => p.test(content));
}

function isContinuation(content: string): boolean {
  return CONTINUATION_PATTERNS.some(p => p.test(content));
}

function shouldMerge(post1: Post, post2: Post): boolean {
  // Never merge if categories are different AND one is a standalone update
  if (post1.category !== post2.category) {
    if (isStandaloneUpdate(post1.content) || isStandaloneUpdate(post2.content)) {
      return false;
    }
  }

  // Both are standalone updates - don't merge
  if (isStandaloneUpdate(post1.content) && isStandaloneUpdate(post2.content)) {
    return false;
  }

  // Check time proximity
  const time1 = new Date(post1.timestamp).getTime();
  const time2 = new Date(post2.timestamp).getTime();
  const timeDiff = Math.abs(time2 - time1);

  if (timeDiff > TIME_THRESHOLD_MS) {
    return false;
  }

  // Both are thoughts - check for continuation patterns
  if (post1.category === 'thought' && post2.category === 'thought') {
    // Get the later post (it might be a continuation)
    const laterPost = time2 > time1 ? post2 : post1;

    // If later post starts with continuation pattern, merge
    if (isContinuation(laterPost.content)) {
      return true;
    }

    // If both are substantial thoughts close in time, likely a thread
    if (post1.content.length > 100 && post2.content.length > 100) {
      return true;
    }
  }

  // Check if second post is explicitly a continuation
  const laterPost = time2 > time1 ? post2 : post1;
  if (isContinuation(laterPost.content)) {
    return true;
  }

  return false;
}

function mergePosts(posts: Post[]): Post {
  // Sort by timestamp ascending (reading order)
  const sorted = [...posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    id: sorted[0].id,
    content: sorted.map((p) => p.content).join('\n\n'),
    timestamp: sorted[0].timestamp,
    category: sorted.some((p) => p.category === 'thought') ? 'thought' : 'update',
    curated: sorted.some((p) => p.curated),
  };
}

function main() {
  console.log('Loading posts...');
  const data: PostsData = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  const originalCount = data.posts.length;

  // Sort by timestamp ascending for processing
  const sorted = [...data.posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  console.log(`Found ${originalCount} posts`);
  console.log('Analyzing threads...\n');

  const finalPosts: Post[] = [];
  let currentThread: Post[] = [];
  let mergedCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const post = sorted[i];

    if (currentThread.length === 0) {
      currentThread.push(post);
      continue;
    }

    const lastInThread = currentThread[currentThread.length - 1];

    if (shouldMerge(lastInThread, post)) {
      currentThread.push(post);
    } else {
      // Finalize current thread
      if (currentThread.length > 1) {
        console.log(`Thread found (${currentThread.length} posts):`);
        currentThread.forEach((p, idx) => {
          const preview = p.content.length > 60 ? p.content.slice(0, 60) + '...' : p.content;
          console.log(`  [${idx + 1}] (${p.category}) ${preview}`);
        });
        console.log('');
        finalPosts.push(mergePosts(currentThread));
        mergedCount++;
      } else {
        finalPosts.push(currentThread[0]);
      }
      currentThread = [post];
    }
  }

  // Handle last thread
  if (currentThread.length > 1) {
    console.log(`Thread found (${currentThread.length} posts):`);
    currentThread.forEach((p, idx) => {
      const preview = p.content.length > 60 ? p.content.slice(0, 60) + '...' : p.content;
      console.log(`  [${idx + 1}] (${p.category}) ${preview}`);
    });
    console.log('');
    finalPosts.push(mergePosts(currentThread));
    mergedCount++;
  } else if (currentThread.length === 1) {
    finalPosts.push(currentThread[0]);
  }

  // Sort by timestamp descending (newest first)
  finalPosts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  console.log(`${'='.repeat(50)}`);
  console.log(`Merged ${mergedCount} thread groups`);
  console.log(`Post count: ${originalCount} → ${finalPosts.length}`);

  data.posts = finalPosts;
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  console.log('Saved to posts.json');
}

main();
