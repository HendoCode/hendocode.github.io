import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'posts'>;

/**
 * Post sort comparators.
 *
 * Both fall back to `order` (a post's position within its series) because several
 * posts in a series can legitimately share one publish date — the migrated
 * anchoring-ai series has seven posts on 2026-06-10 — and date alone would leave
 * their listing order up to whatever order the content loader happened to return.
 */

/** Newest first; same-date posts stay in series reading order. */
export const byDateDesc = (a: Post, b: Post) =>
  new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf() ||
  (a.data.order ?? 0) - (b.data.order ?? 0);

/** Oldest first; used by the series nav at the foot of a post page. */
export const byDateAsc = (a: Post, b: Post) =>
  new Date(a.data.date).valueOf() - new Date(b.data.date).valueOf() ||
  (a.data.order ?? 0) - (b.data.order ?? 0);
