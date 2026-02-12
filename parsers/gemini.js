(function registerGeminiParser() {
  function mapMessageNode(node, index) {
    const text = node.innerText?.trim() || '';
    const images = Array.from(node.querySelectorAll('img')).map((img) => ({
      type: 'image',
      url: img.currentSrc || img.src || '',
      alt: img.alt || '',
      mime: 'image/*'
    })).filter((i) => i.url);

    return {
      id: `gemini_${index + 1}`,
      platform: 'gemini',
      role: inferRole(node),
      content: text,
      segments: [
        ...(text ? [{ type: 'text', text }] : []),
        ...images
      ],
      meta: {
        hasImage: images.length > 0,
        imageUrls: images.map((x) => x.url),
        hasFile: false,
        fileCount: 0,
        hasCodeBlock: Boolean(node.querySelector('pre code')),
        hasCitations: false,
        citationCount: 0
      }
    };
  }

  function inferRole(node) {
    const raw = (node.getAttribute('data-testid') || '').toLowerCase();
    if (raw.includes('user')) return 'user';
    if (raw.includes('model') || raw.includes('response')) return 'model';
    return 'model';
  }

  function parseGeminiChat() {
    const main = document.querySelector('[role="main"], main') || document.body;
    const candidates = Array.from(main.querySelectorAll('[data-testid], article, section'))
      .filter((el) => (el.innerText || '').trim().length > 0)
      .slice(0, 200);

    return candidates.map(mapMessageNode);
  }

  window.GeminiParser = { parseGeminiChat };
})();
