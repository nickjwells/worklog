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
  profile: { name: string; handle: string; bio: string };
  posts: Post[];
}

const client = new Anthropic();

// Only consider posts within 10 minutes as potential thread candidates
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
      continue;
    }

    const lastPost = currentGroup[currentGroup.length - 1];
    const timeDiff = new Date(post.timestamp).getTime() - new Date(lastPost.timestamp).getTime();

    if (timeDiff <= TIME_THRESHOLD_MS) {
      currentGroup.push(post);
    } else {
      groups.push(currentGroup);
      currentGroup = [post];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

async function analyzeThreadGroup(posts: Post[]): Promise<number[][]> {
  const content = posts
    .map((p, i) => `[${i}] (${p.category}) "${p.content}"`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are analyzing Twitter posts to identify threads (multi-part tweets that form a single continuous thought).

RULES FOR THREAD DETECTION:
1. A thread is a SINGLE CONTINUOUS THOUGHT split across multiple tweets
2. Posts must have NARRATIVE CONTINUITY - the second post continues where the first left off
3. Posts must be the SAME TYPE - never merge an "update" (task completion) with a "thought" (reflection)
4. Short status updates like "Completed X" or "Recorded Y" are NOT threads even if posted together
5. Only merge when it's OBVIOUS the author intended these as one message split across tweets

EXAMPLES OF REAL THREADS (should merge):
- "Coming to the conclusion that X doesn't work..." → "So I'm going to try Y instead..." → "It'll be simple and straightforward..."
- "Finding: X is really important..." → "This means we should..." → "All this to say..."

EXAMPLES THAT ARE NOT THREADS (don't merge):
- "Completed task A" + "Completed task B" (separate updates, not a thread)
- "Recorded video" + "I think social media is broken" (update + unrelated thought)
- "Gym day" + "Built new feature" (unrelated updates)

Here are ${posts.length} posts to analyze:

${content}

Return a JSON array of arrays, where each inner array contains indices that form a thread.
- Posts that aren't part of any thread should be in their own single-element array
- Example: [[0], [1, 2, 3], [4, 5], [6]] means posts 1-2-3 are one thread, 4-5 are another, 0 and 6 are standalone

Return ONLY the JSON array, nothing else.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const match = text.match(/\[[\s\S]*\]/);

  if (!match) {
    console.error('Failed to parse:', text);
    return posts.map((_, i) => [i]);
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    console.error('JSON parse error:', text);
    return posts.map((_, i) => [i]);
  }
}

function mergePosts(posts: Post[]): Post {
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

async function main() {
  console.log('Loading posts...');
  const data: PostsData = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  const originalCount = data.posts.length;

  console.log(`Found ${originalCount} posts`);
  console.log('Grouping by time proximity...');

  const timeGroups = groupByTimeProximity(data.posts);
  const multiPostGroups = timeGroups.filter((g) => g.length > 1);

  console.log(`Found ${multiPostGroups.length} groups with multiple posts to analyze`);

  const finalPosts: Post[] = [];
  let mergedCount = 0;

  for (let i = 0; i < timeGroups.length; i++) {
    const group = timeGroups[i];

    if (group.length === 1) {
      finalPosts.push(group[0]);
      continue;
    }

    console.log(`\nAnalyzing group ${i + 1}/${timeGroups.length} (${group.length} posts)...`);
    group.forEach((p, idx) => {
      const preview = p.content.length > 50 ? p.content.slice(0, 50) + '...' : p.content;
      console.log(`  [${idx}] (${p.category}) ${preview}`);
    });

    const threadGroups = await analyzeThreadGroup(group);
    console.log(`  → Identified ${threadGroups.length} separate items`);

    for (const indices of threadGroups) {
      const threadPosts = indices.map((idx) => group[idx]);
      if (indices.length > 1) {
        console.log(`  → Merging indices [${indices.join(', ')}] as thread`);
        finalPosts.push(mergePosts(threadPosts));
        mergedCount++;
      } else {
        finalPosts.push(threadPosts[0]);
      }
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Sort by timestamp descending
  finalPosts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Merged ${mergedCount} thread groups`);
  console.log(`Post count: ${originalCount} → ${finalPosts.length}`);

  data.posts = finalPosts;
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  console.log('Saved to posts.json');
}

main().catch(console.error);
