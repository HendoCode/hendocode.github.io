import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { byDateDesc } from '../lib/posts';

export async function GET(context) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(byDateDesc);

  return rss({
    title: 'HendoCode',
    description: 'Stephen Henderson\'s personal technical blog and portfolio',
    site: context.site,
    items: sortedPosts.map(post => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: new Date(post.data.date),
      link: `/posts/${post.slug}`
    }))
  });
}
