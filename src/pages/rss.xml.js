import { getCollection } from 'astro:content';
import { getRssString } from '@astrojs/rss';

export async function get() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
  
  return getRssString({
    title: 'HendoCode',
    description: 'Stephen Henderson\'s personal technical blog and portfolio',
    site: 'https://hendocode.github.io',
    items: sortedPosts.map(post => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: new Date(post.data.date),
      link: `/posts/${post.slug}`
    }))
  });
}