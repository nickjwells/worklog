import { getStore } from "@netlify/blobs";

interface PendingPost {
  id: string;
  content: string;
  timestamp: string;
  category: string;
  curated: boolean;
}

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const store = getStore("pending-posts");

  if (req.method === "GET") {
    const raw = await store.get("posts");
    const posts: PendingPost[] = raw ? JSON.parse(raw) : [];

    const now = Date.now();
    const fresh = posts.filter(
      (p) => now - new Date(p.timestamp).getTime() < MAX_AGE_MS
    );

    if (fresh.length !== posts.length) {
      await store.set("posts", JSON.stringify(fresh));
    }

    return new Response(JSON.stringify({ posts: fresh }), { headers });
  }

  if (req.method === "POST") {
    const post = (await req.json()) as PendingPost;

    if (!post.content || !post.id) {
      return new Response(
        JSON.stringify({ error: "id and content required" }),
        { status: 400, headers }
      );
    }

    const raw = await store.get("posts");
    const posts: PendingPost[] = raw ? JSON.parse(raw) : [];
    posts.unshift(post);
    await store.set("posts", JSON.stringify(posts));

    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers }
  );
};

export const config = {
  path: "/.netlify/functions/pending-posts",
};
