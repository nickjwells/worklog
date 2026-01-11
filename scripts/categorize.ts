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

const CATEGORIZATION_PROMPT = `You are categorizing social media posts for a work log app.

CATEGORIES:
- "update": A deliverable, task completion, or work activity. Examples: "Recorded 7 roasts", "Completed management for today", "Sent 3 applications", "Leg day", "Created thumbnail"
- "thought": A reflection, idea, opinion, observation, or commentary. Examples: "I am achieving a shockingly small slice of my potential", "New idea: I'm going to...", observations about business strategy, reflections on productivity

RULES:
1. If it describes something DONE/COMPLETED → "update"
2. If it's an IDEA, OPINION, or REFLECTION → "thought"
3. Short status updates about tasks → "update"
4. Longer reflections or insights → "thought"

For each post, respond with ONLY a JSON object:
{"category": "update" or "thought", "curated": true/false}

Set "curated" to true ONLY for thoughts that are:
- Novel insights or unique perspectives
- High-quality reflections worth revisiting
- Strategic ideas or profound observations
- NOT mundane updates or simple status posts

Posts to categorize:
`;

const BATCH_SIZE = 50;

async function categorizePostBatch(posts: Post[]): Promise<{ id: string; category: 'update' | 'thought'; curated: boolean }[]> {
  const postsText = posts.map((p, i) => `[${i}] ${p.content}`).join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: CATEGORIZATION_PROMPT + postsText + `\n\nRespond with a JSON array of ${posts.length} objects, one for each post [0] through [${posts.length - 1}], in order. Format: [{"category": "...", "curated": ...}, ...]`
      }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('Failed to parse response:', text);
    // Default to updates
    return posts.map(p => ({ id: p.id, category: 'update' as const, curated: false }));
  }

  try {
    const results = JSON.parse(jsonMatch[0]);
    return posts.map((p, i) => ({
      id: p.id,
      category: results[i]?.category || 'update',
      curated: results[i]?.curated || false
    }));
  } catch (e) {
    console.error('JSON parse error:', e);
    return posts.map(p => ({ id: p.id, category: 'update' as const, curated: false }));
  }
}

async function main() {
  console.log('Loading posts...');
  const data: PostsData = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  const posts = data.posts;

  console.log(`Found ${posts.length} posts to categorize`);

  const results: Map<string, { category: 'update' | 'thought'; curated: boolean }> = new Map();

  // Process in batches
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)}...`);

    const batchResults = await categorizePostBatch(batch);
    batchResults.forEach(r => results.set(r.id, { category: r.category, curated: r.curated }));

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Update posts with categories
  data.posts = posts.map(p => ({
    ...p,
    category: results.get(p.id)?.category || 'update',
    curated: results.get(p.id)?.curated || false
  }));

  // Count results
  const updates = data.posts.filter(p => p.category === 'update').length;
  const thoughts = data.posts.filter(p => p.category === 'thought').length;
  const curated = data.posts.filter(p => p.curated).length;

  console.log(`\nResults:`);
  console.log(`  Updates: ${updates}`);
  console.log(`  Thoughts: ${thoughts}`);
  console.log(`  Curated: ${curated}`);

  // Save
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  console.log('\nSaved to posts.json');
}

main().catch(console.error);
