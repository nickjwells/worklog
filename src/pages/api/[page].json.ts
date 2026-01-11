import type { APIRoute, GetStaticPaths } from 'astro';
import postsData from '../../../data/posts.json';

const POSTS_PER_PAGE = 100;

// Sort posts by timestamp descending
const sortedPosts = [...postsData.posts].sort((a, b) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
);

// Calculate total pages (excluding first page which is in HTML)
const remainingPosts = sortedPosts.slice(POSTS_PER_PAGE);
const totalPages = Math.ceil(remainingPosts.length / POSTS_PER_PAGE);

export const getStaticPaths: GetStaticPaths = () => {
  const paths = [];
  for (let i = 2; i <= totalPages + 1; i++) {
    paths.push({ params: { page: String(i) } });
  }
  return paths;
};

export const GET: APIRoute = ({ params }) => {
  const page = parseInt(params.page || '2');
  const startIndex = (page - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE;

  const pagePosts = sortedPosts.slice(startIndex, endIndex);

  return new Response(JSON.stringify({
    posts: pagePosts,
    hasMore: endIndex < sortedPosts.length,
    page,
    totalPages: Math.ceil(sortedPosts.length / POSTS_PER_PAGE),
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
