import type { Handler, HandlerEvent } from "@netlify/functions";

const GITHUB_OWNER = "nickjwells";
const GITHUB_REPO = "worklog";
const FILE_PATH = "data/posts.json";

interface PostRequest {
  content: string;
  category: "update" | "thought";
  password: string;
  curated?: boolean;
}

interface Post {
  id: string;
  content: string;
  timestamp: string;
  category: "update" | "thought";
  curated: boolean;
}

interface PostsData {
  profile: {
    name: string;
    handle: string;
    bio: string;
  };
  posts: Post[];
}

const handler: Handler = async (event: HandlerEvent) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { content, category, password, curated } = JSON.parse(
      event.body || "{}"
    ) as PostRequest;

    // Validate password
    if (password !== process.env.POST_PASSWORD) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid password" }),
      };
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Content is required" }),
      };
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Server configuration error" }),
      };
    }

    // Fetch current posts.json from GitHub
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Worklog-Poster",
        },
      }
    );

    if (!getFileResponse.ok) {
      const errorText = await getFileResponse.text();
      console.error("GitHub GET error:", errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch posts" }),
      };
    }

    const fileData = await getFileResponse.json();
    const currentContent = Buffer.from(fileData.content, "base64").toString(
      "utf-8"
    );
    const postsData: PostsData = JSON.parse(currentContent);

    // Create new post
    const newPost: Post = {
      id: `post-${Date.now()}`,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      category: category || "update",
      curated: curated || false,
    };

    // Add to beginning of posts array
    postsData.posts.unshift(newPost);

    // Commit updated posts.json
    const updateResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Worklog-Poster",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Add post",
          content: Buffer.from(JSON.stringify(postsData, null, 2)).toString(
            "base64"
          ),
          sha: fileData.sha,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("GitHub PUT error:", errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to save post" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        post: newPost,
        message: "Post added. Site will rebuild in ~30 seconds.",
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export { handler };
