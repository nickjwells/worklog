import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POSTS_FILE = join(__dirname, '../data/posts.json');

interface Tweet {
  id: string;
  text?: string;
  fullText?: string;
  createdAt: string;
}

interface Post {
  id: string;
  content: string;
  timestamp: string;
  category?: 'update' | 'thought';
  curated?: boolean;
}

// Pattern-based categorization
const UPDATE_PATTERNS = [
  /^completed/i, /^recorded/i, /^sent/i, /^hosted/i, /^finished/i,
  /^reviewed/i, /^created/i, /^built/i, /^fixed/i, /^posted/i,
  /^published/i, /^wrote/i, /^paid/i, /^set up/i, /^crushed/i,
  /^1:1 with/i, /gym/i, /roasts? for/i, /management for/i,
  /^responded to/i, /^cancelled/i, /^purchased/i, /^donated/i,
  /^tested/i, /^experimented/i, /^watched/i, /^prepared/i,
  /^iterated/i, /^signed/i, /^removed/i, /^added/i, /^updated/i,
  /^messaged/i, /^enriched/i, /^ran/i, /^implemented/i, /^scraped/i,
  /^refactored/i, /^rebuilt/i, /^appealed/i, /^ordered/i,
  /leg day/i, /chest day/i, /back day/i, /arm day/i,
  /weekly office hour/i, /weekly community call/i, /live build/i,
  /podcast with/i, /stream with/i, /team meeting/i,
];

const THOUGHT_PATTERNS = [
  /^i think/i, /^i believe/i, /^i feel/i, /^i am/i, /^i'm/i,
  /^coming to the conclusion/i, /^finding:/i, /^new idea/i,
  /^the key/i, /^biggest/i, /^interesting/i, /^wow/i,
  /should be/i, /could be/i, /is huge/i, /are huge/i,
  /all this to say/i, /learnings:/i, /observation/i,
  /^can't believe/i, /^feels great/i, /^not having/i,
  /^this is what/i, /^my \w+ now looks/i, /doesn't work for me/i,
  /going to stop/i, /going to start/i, /decided to/i,
  /key here was/i, /you can totally/i, /definitely going to/i,
];

const CURATED_INDICATORS = [
  /strategy/i, /framework/i, /insight/i, /learning/i,
  /principle/i, /realization/i, /epiphany/i, /breakthrough/i,
  /game.?changer/i, /key (here|takeaway|insight)/i,
  /all this to say/i, /the (biggest|best|key|most important)/i,
  /i (realized|discovered|learned|found that)/i,
  /consistent .* raises/i, /significantly more/i,
  /unbeatable/i, /best .* by far/i, /biggest hack/i,
  /saves at least/i, /turns out/i, /wild west/i,
  /professional situation monitor/i, /algorithmic bullshit/i,
];

function categorizePost(content: string): { category: 'update' | 'thought'; curated: boolean } {
  const isUpdate = UPDATE_PATTERNS.some(p => p.test(content));
  const isThought = THOUGHT_PATTERNS.some(p => p.test(content));
  const isCurated = CURATED_INDICATORS.some(p => p.test(content));

  let category: 'update' | 'thought' = 'update';
  if (isThought && !isUpdate) {
    category = 'thought';
  } else if (isThought && isUpdate) {
    category = content.length > 150 ? 'thought' : 'update';
  } else if (!isThought && !isUpdate) {
    category = content.length > 200 ? 'thought' : 'update';
  }

  return {
    category,
    curated: category === 'thought' && isCurated,
  };
}

function parseTwitterDate(dateStr: string): Date {
  return new Date(dateStr);
}

function main() {
  console.log('Loading Twitter data...');
  const tweets: Tweet[] = JSON.parse(readFileSync('/tmp/twitter-backup.json', 'utf-8'));

  console.log(`Found ${tweets.length} tweets`);

  // Convert to posts
  const posts: Post[] = tweets.map((tweet) => {
    const content = tweet.fullText || tweet.text || '';
    const { category, curated } = categorizePost(content);

    return {
      id: `tw-${tweet.id}`,
      content,
      timestamp: parseTwitterDate(tweet.createdAt).toISOString(),
      category,
      curated,
    };
  });

  // Sort by timestamp descending
  posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Count categories
  const updates = posts.filter((p) => p.category === 'update').length;
  const thoughts = posts.filter((p) => p.category === 'thought').length;
  const curated = posts.filter((p) => p.curated).length;

  console.log(`\nCategories:`);
  console.log(`  Updates: ${updates}`);
  console.log(`  Thoughts: ${thoughts}`);
  console.log(`  Curated: ${curated}`);

  // Load existing profile
  const existingData = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));

  // Save
  const data = {
    profile: existingData.profile,
    posts,
  };

  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  console.log(`\nSaved ${posts.length} posts to posts.json`);
}

main();
