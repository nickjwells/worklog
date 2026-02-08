import type { Handler, HandlerEvent } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface PendingPost {
  id: string;
  content: string;
  timestamp: string;
  category: string;
  curated: boolean;
}

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const store = getStore("pending-posts");

  if (event.httpMethod === "GET") {
    const raw = await store.get("posts");
    const posts: PendingPost[] = raw ? JSON.parse(raw) : [];

    // Filter out posts older than MAX_AGE_MS
    const now = Date.now();
    const fresh = posts.filter(
      (p) => now - new Date(p.timestamp).getTime() < MAX_AGE_MS
    );

    if (fresh.length !== posts.length) {
      await store.set("posts", JSON.stringify(fresh));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: fresh }),
    };
  }

  if (event.httpMethod === "POST") {
    const post = JSON.parse(event.body || "{}") as PendingPost;

    if (!post.content || !post.id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "id and content required" }),
      };
    }

    const raw = await store.get("posts");
    const posts: PendingPost[] = raw ? JSON.parse(raw) : [];
    posts.unshift(post);
    await store.set("posts", JSON.stringify(posts));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true }),
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};

export { handler };
