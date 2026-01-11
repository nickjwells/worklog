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

// Patterns that indicate UPDATES (deliverables, completed tasks)
const UPDATE_PATTERNS = [
  /^Recorded \d+/i,
  /^Recorded /i,
  /^Completed /i,
  /^Created /i,
  /^Built /i,
  /^Sent \d+/i,
  /^Responded to \d+/i,
  /^Reviewed /i,
  /^Hosted /i,
  /^Crushed (leg|back|chest|arm|shoulder)/i,
  /^Leg day/i,
  /^Back day/i,
  /^Chest day/i,
  /day \ud83d\udcaa/i,
  /^1:1 with/i,
  /^Podcast with/i,
  /^Cancelled/i,
  /^Refunded/i,
  /^Removed /i,
  /^Messaged /i,
  /^Invited /i,
  /^Set up /i,
  /^Fixed /i,
  /^Wrote /i,
  /^Migrated /i,
  /^Outlined /i,
  /^Edited/i,
  /^Uploaded/i,
  /^Booked /i,
  /^Took thumbnails/i,
  /^Prepared for/i,
  /^Roasted /i,
  /^Tested /i,
  /^Bought /i,
  /^Iterated /i,
  /^Added /i,
  /^Dealt with/i,
  /^Found /i,
  /^Coached /i,
  /^Scoped /i,
  /^Wrapped up/i,
  /^Planned out/i,
  /^Cut /i,
  /^Reorganized/i,
  /^Weekly (Office Hour|Community Call)/i,
  /management for (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
];

// Patterns that indicate THOUGHTS (reflections, ideas, opinions)
const THOUGHT_PATTERNS = [
  /^I (am|was|think|feel|believe|noticed|tried|get)/i,
  /^Coming to the conclusion/i,
  /^So I'm going to/i,
  /^It'll be /i,
  /^New (project|idea)/i,
  /^Possible /i,
  /^Wow/i,
  /^All this to say/i,
  /^But if you/i,
  /^Second day of/i,
  /^Third day of/i,
  /^First day of/i,
  /^Have been dragging/i,
  /^Only six modules/i,
  /^Drowning in/i,
  /^Feels great/i,
  /^Well, I tried/i,
  /^That's\.\.\./i,
  /^\w+ is SO/i,
  /my \$0\.02/i,
  /achievin.*potential/i,
  /strategy/i,
  /routine/i,
];

// Curated thought indicators (novel insights, strategic thinking)
const CURATED_INDICATORS = [
  /^Coming to the conclusion/i,
  /^New (project|idea)/i,
  /^Possible strategic/i,
  /^All this to say/i,
  /^I am achieving/i,
  /my \$0\.02/i,
  /potential/i,
  /strategy/i,
  /reminder that/i,
  /lesson/i,
  /insight/i,
  /realize/i,
  /free marketing/i,
  /mental bandwidth/i,
  /shockingly/i,
];

function categorizePost(content: string): { category: 'update' | 'thought'; curated: boolean } {
  const trimmed = content.trim();

  // Check for update patterns first
  for (const pattern of UPDATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { category: 'update', curated: false };
    }
  }

  // Check for thought patterns
  for (const pattern of THOUGHT_PATTERNS) {
    if (pattern.test(trimmed)) {
      // Check if it's curated
      let curated = false;
      for (const curatedPattern of CURATED_INDICATORS) {
        if (curatedPattern.test(trimmed)) {
          curated = true;
          break;
        }
      }
      // Also curate longer, more substantial thoughts
      if (trimmed.length > 200 && !curated) {
        curated = true;
      }
      return { category: 'thought', curated };
    }
  }

  // Default heuristics
  // Short posts (< 50 chars) are likely updates
  if (trimmed.length < 50) {
    return { category: 'update', curated: false };
  }

  // Longer posts (> 200 chars) are likely thoughts
  if (trimmed.length > 200) {
    return { category: 'thought', curated: true };
  }

  // Medium length - check for reflective language
  const reflectiveWords = ['think', 'feel', 'believe', 'seems', 'maybe', 'probably', 'honestly', 'frankly'];
  const hasReflective = reflectiveWords.some(word => trimmed.toLowerCase().includes(word));

  if (hasReflective) {
    return { category: 'thought', curated: false };
  }

  // Default to update
  return { category: 'update', curated: false };
}

function main() {
  console.log('Loading posts...');
  const data: PostsData = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));

  console.log(`Categorizing ${data.posts.length} posts...`);

  // Categorize each post
  data.posts = data.posts.map(post => {
    const { category, curated } = categorizePost(post.content);
    return { ...post, category, curated };
  });

  // Count results
  const updates = data.posts.filter(p => p.category === 'update').length;
  const thoughts = data.posts.filter(p => p.category === 'thought').length;
  const curated = data.posts.filter(p => p.curated).length;

  console.log(`\nResults:`);
  console.log(`  Updates: ${updates}`);
  console.log(`  Thoughts: ${thoughts}`);
  console.log(`  Curated: ${curated}`);

  // Show some curated examples
  console.log(`\nSample curated thoughts:`);
  data.posts.filter(p => p.curated).slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.content.substring(0, 80)}...`);
  });

  // Save
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
  console.log('\nSaved to posts.json');
}

main();
