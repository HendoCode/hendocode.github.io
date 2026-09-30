import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMermaid from './src/lib/remark-mermaid.mjs';

export default defineConfig({
  site: 'https://hendocode.com',
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [remarkMermaid],
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark'
    }
  }
});