// Remark plugin: rewrite ```mermaid fences to <pre class="mermaid">.
//
// Without this, Astro's Shiki step turns the fence into a highlighted code block and
// the diagram shows up as source text. Emitting a raw <pre class="mermaid"> instead
// keeps Shiki out of it (it only touches <pre><code>), and the loader script at the
// end of src/layouts/Layout.astro renders it in the browser.
//
// The source is HTML-escaped: the browser decodes it back, so Mermaid reads the
// original text from textContent, arrows (-->) included.

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function remarkMermaid() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'code' && child.lang === 'mermaid') {
          return {
            type: 'html',
            value: `<pre class="mermaid">${escapeHtml(child.value)}</pre>`,
          };
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
