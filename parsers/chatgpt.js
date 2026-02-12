(function registerChatGPTParser() {
  function collectCitations(node) {
    const links = Array.from(node.querySelectorAll('a[href^="http"]'));
    return links.map((a, idx) => ({
      title: a.textContent?.trim() || `Source ${idx + 1}`,
      url: a.href,
      domain: (() => {
        try {
          return new URL(a.href).hostname;
        } catch {
          return '';
        }
      })(),
      snippet: ''
    }));
  }

  function parseChatGPTChat() {
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

      const files = Array.from(node.querySelectorAll('a[download], [data-file-id], a[href*="/files/"]')).map((el) => ({
        type: 'file',
        name: el.getAttribute('download') || el.textContent?.trim() || 'file',
        url: el.href || '',
        mime: 'application/octet-stream'
      })).filter((f) => f.url || f.name);

      const citations = collectCitations(node);

      return {
        id: `chatgpt_${index + 1}`,
        platform: 'chatgpt',
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
          hasCitations: citations.length > 0,
          citationCount: citations.length
        },
        fact_check: {
          actions: citations.map((source, i) => ({
            type: 'citation',
            label: `Source [${i + 1}]`,
            url: source.url,
            accessed_at: new Date().toISOString()
          })),
          sources: citations
        }
      };
    });
  }

  window.ChatGPTParser = { parseChatGPTChat };
})();
