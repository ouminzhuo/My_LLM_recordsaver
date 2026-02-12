(function registerGrokParser() {
  function parseGrokChat() {
    const main = document.querySelector('[role="main"], main') || document.body;
    const nodes = Array.from(main.querySelectorAll('article, [data-testid], section'))
      .filter((el) => (el.innerText || '').trim())
      .slice(0, 200);

    return nodes.map((node, index) => {
      const text = node.innerText?.trim() || '';
      const images = Array.from(node.querySelectorAll('img')).map((img) => ({
        type: 'image',
        url: img.currentSrc || img.src || '',
        alt: img.alt || '',
        mime: 'image/*'
      })).filter((i) => i.url);

      const files = Array.from(node.querySelectorAll('a[href$=".pdf"], a[download], [data-file-id]')).map((el) => ({
        type: 'file',
        name: el.getAttribute('download') || el.textContent?.trim() || 'file',
        url: el.href || '',
        mime: 'application/octet-stream'
      })).filter((f) => f.url || f.name);

      return {
        id: `grok_${index + 1}`,
        platform: 'grok',
        role: 'model',
        content: text,
        segments: [
          ...(text ? [{ type: 'text', text }] : []),
          ...images,
          ...files
        ],
        meta: {
          hasImage: images.length > 0,
          imageUrls: images.map((x) => x.url),
          hasFile: files.length > 0,
          fileCount: files.length,
          hasCodeBlock: Boolean(node.querySelector('pre code')),
          hasCitations: false,
          citationCount: 0
        }
      };
    });
  }

  window.GrokParser = { parseGrokChat };
})();
