# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Sharp edge: Layout.astro's `<style>` must stay `is:global`

All site styling lives in one `<style is:global>` block in `src/layouts/Layout.astro`. The
`is:global` is load-bearing, not cosmetic: Astro scopes a component's `<style>` to elements
carrying its `data-astro-cid-*` attribute, but `<slot />` content is rendered by the *page*
component and never receives that attribute. With a scoped stylesheet, every rule for
`h1`/`p`/`a`/`code`/`pre`/`.post-list-item`/`.tag-chip`/`.post-content` silently fails to
match, and the content area renders as unstyled browser default while nav/footer still look
fine — so the breakage is easy to miss. It shipped broken once already. Never remove
`is:global`, and don't move these rules into a page-level scoped `<style>`.

## Brand source of truth

The HendoCode design language is not invented here — it is copied from the reference
implementation at `github.com/HendoCode/contact-center-ai`, file `blogs/template.html`
(its CSS block is identical in `blogs/index.html`, which is byte-identical to the deployed
`hendocode.com/contact-center-ai/`). Clone that repo read-only to check fidelity. The palette
primitives and the wordmark/heading/nav rules in `Layout.astro` are commented with their
reference provenance; keep values verbatim rather than "improving" them, and treat dark mode
as this repo's own extension (the reference ships light-only).

Two known deliberate deviations, both because this repo's brief outranks the reference on
structure: content measure is **680px** (reference is 720px), and the reference's Google
Analytics tag, Mermaid loader, `scroll-behavior: smooth` and `0.15s` hover transitions are
**not** carried over.

## Structural constraints for this site

Content-forward and spare, by explicit product decision — do not add: hero sections, card
grids, animations (the colour-mode fade on `body`/`nav.top-nav`/`footer.site-footer` is the
only permitted transition, and it must never be applied to `:hover`), comments, share
buttons, newsletter signup, search, or analytics. Post listings stay plain hairline-separated
rows. Several of these are things the reference site does have; omitting them is intentional.

## Verifying changes

`npm run build` (Astro static build) is the only gate — there is no test suite and no CI
checks on this repo, and there is no browser available on the worker box, so verification is
build-level plus reading the emitted `dist/**/*.html` and `dist/_astro/*.css`.

The 12 `anchoring-ai` posts are live (`draft: false`), so a default build emits their post and
tag pages — enough on its own to check `.post-content` rendering (code blocks, tables,
blockquotes, chips, series nav). Every other file in `src/content/posts/` is still a draft.
If you add a scratch post for something the series doesn't exercise, note Astro content
collections **ignore filenames beginning with `_`**, so a name like `__check.md` is silently
skipped. Delete the scratch post before committing.

## The anchoring-ai series is migrated content — keep it verbatim

The 12 posts with `series: "anchoring-ai"` were migrated from
`github.com/HendoCode/contact-center-ai` (`blogs/NN-slug/index.md`), which remains the upstream
source. Hendo's prose is reproduced verbatim; if upstream changes, re-copy the body rather than
rewriting or "improving" it. Only the frontmatter and intra-series links (`../NN-slug/` →
`/posts/<slug>/`) differ from upstream, and upstream's `prev_url`/`next_url` are dropped because
`posts/[slug].astro` renders its own series nav.

Six of the twelve are upstream placeholders and two are structured drafts. They ship here as
non-draft on purpose (the series is meant to be complete on this site) and each keeps its own
`> **Status: Placeholder.**` line — don't strip it and don't treat it as a defect. Upstream also
renumbered the series mid-flight, so a few in-body cross-references ("Post 8", post 01's "What's
Coming" table) cite stale numbers; that drift is upstream's and was left as authored.

`the-blueprint` carries five ` ```mermaid ` fences. This site has no Mermaid loader (see the
deliberate deviations above), so Shiki emits them as unhighlighted code and the diagrams read as
source text. That is the accepted state — wiring a Mermaid CDN script into `Layout.astro` is a
product decision, not a build fix.

## Post ordering: `subtitle`, `order`, and src/lib/posts.ts

`subtitle` (deck line, rendered with the existing `.page-subtitle` style) and `order` (position
within `series`) are optional fields on the posts schema. `order` exists because seven of the
twelve anchoring-ai posts share the publish date 2026-06-10, so date alone cannot order them.
Every listing sorts through `src/lib/posts.ts` (`byDateDesc`/`byDateAsc` — date, then `order`);
use it in any new listing page instead of writing a fresh comparator, or same-date posts come
out in whatever order the content loader returned them.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
