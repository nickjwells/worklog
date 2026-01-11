import Anthropic from '@anthropic-ai/sdk';
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

const client = new Anthropic();

// Group posts that are within 10 minutes of each other
const TIME_THRESHOLD_MS = 10 * 60 * 1000;

function groupByTimeProximity(posts: Post[]): Post[][] {
  const sorted = [...posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const groups: Post[][] = [];
  let currentGroup: Post[] = [];

  for (const post of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(post);
    } else {
      const lastPost = currentGroup[currentGroup.length - 1];
      const timeDiff =
        new Date(post.timestamp).getTime() - new Date(lastPost.timestamp).getTime();

      if (timeDiff <= TIME_THRESHOLD_MS) {
        currentGroup.push(post);
      } else {
        groups.push(currentGroup);
        currentGroup = [post];
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

async function shouldMergeGroup(posts: Post[]): Promise<boolean> {
  if (posts.length < 2) return false;

  const content = posts.map((p, i) => `[${i + 1}] ${p.content}`).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Are these posts part of the same Twitter thread (a continuous thought/story posted in sequence)? Answer only "yes" or "no".

${content}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.toLowerCase() : '';
  return text.includes('yes');
}

function mergePostGroup(posts: Post[]): Post {
  // Sort by timestamp (oldest first for reading order)
  const sorted = [...posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Combine content with line breaks
  const combinedContent = sorted.map((p) => p.content).join('\n\n');

  // Use the most recent timestamp
  const latestTimestamp = sorted[sorted.length - 1].timestamp;

  // Use first post's ID
  const firstId = sorted[0].id;

  // If any is curated, mark as curated
  const isCurated = sorted.some((p) => p.curated);

  // If any is thought, mark as thought
  const category = sorted.some((p) => p.category === 'thought') ? 'thought' : 'update';

  return {
    id: firstId,
    content: combinedContent,
    timestamp: latestTimestamp,
    category,
    curated: isCurated,
  };
}

async function main() {
  console.log('Loading posts...');
  const data: PostsData = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  const posts = data.posts;

  console.log(`Found ${posts.length} posts`);
  console.log('Grouping by time proximity...');

  const groups = groupByTimeProximity(posts);
  const multiPostGroups = groups.filter((g) => g.length > 1);

  console.log(`Found ${multiPostGroups.length} potential thread groups`);

  const mergedPosts: Post[] = [];
  const processedIds = new Set<string>();
  let mergeCount = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    if (group.length === 1) {
      mergedPosts.push(group[0]);
      processedIds.add(group[0].id);
      continue;
    }

    console.log(`\nChecking group of ${group.length} posts (${i + 1}/${groups.length})...`);
    group.forEach((p, idx) => console.log(`  [${idx + 1}] ${p.content.slice(0, 60)}...`));

    const shouldMerge = await shouldMergeGroup(group);

    if (shouldMerge) {
      console.log('  → Merging as thread');
      const merged = mergePostGroup(group);
      mergedPosts.push(merged);
      group.forEach((p) => processedIds.add(p.id));
      mergeCount++;
    } else {
      console.log('  → Keeping separate');
      group.forEach((p) => {
        mergedPosts.push(p);
        processedIds.add(p.id);
      });
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Sort by timestamp descending (newest first)
  mergedPosts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  console.log(`\nMerged ${mergeCount} thread groups`);
  console.log(`Final post count: ${mergedPosts.length} (was ${posts.length})`);

  data.posts = mergedPosts;
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  console.log('Saved to posts.json');
}

main().catch(console.error);
