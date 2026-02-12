(function registerGeminiParser() {
  const NOISE_PATTERNS = [
    /show drafts?/i,
    /regenerate/i,
    /modify response/i,
    /thumbs up|thumbs down/i,
    /^copy$/i,
    /^share$/i
  ];

  function isNoiseLine(line) {
    if (!line) return true;
    return NOISE_PATTERNS.some((re) => re.test(line.trim()));
  }

  function cleanText(raw) {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !isNoiseLine(line))
      .join('\n')
      .replace(/\[(\d+)\]/g, '')
      .trim();
  }

  function collectFromRoot(root, selector) {
    const out = [];
    const stack = [root];

    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      if (current.querySelectorAll) {
        out.push(...current.querySelectorAll(selector));
      }

      const children = current.children ? Array.from(current.children) : [];
      for (const child of children) {
        if (child.shadowRoot) stack.push(child.shadowRoot);
        stack.push(child);
      }
    }

    return out;
  }

  function inferRole(node) {
    const tag = (node.tagName || '').toLowerCase();
    const testId = (node.getAttribute?.('data-testid') || '').toLowerCase();
    const text = (node.textContent || '').toLowerCase();

    if (tag.includes('user-query') || testId.includes('user')) return 'user';
    if (tag.includes('model-response') || testId.includes('model') || testId.includes('response')) return 'model';
    if (text.includes('you said')) return 'user';
    return 'model';
  }

  function mapMessageNode(node, index) {
    const rawText = node.innerText || node.textContent || '';
    const text = cleanText(rawText);

    const images = Array.from(node.querySelectorAll('img'))
      .map((img) => ({
        type: 'image',
        url: img.currentSrc || img.src || '',
        alt: img.alt || '',
        mime: 'image/*'
      }))
      .filter((item) => item.url);

    const files = Array.from(node.querySelectorAll('a[href*="/files/"], a[download]'))
      .map((el) => ({
        type: 'file',
        name: el.getAttribute('download') || el.textContent?.trim() || 'file',
        url: el.href || '',
        mime: 'application/octet-stream'
      }))
      .filter((item) => item.url || item.name);

    const segments = [
      ...(text ? [{ type: 'text', text }] : []),
      ...images,
      ...files
    ];

    return {
      id: `gemini_${index + 1}`,
      platform: 'gemini',
      role: inferRole(node),
      content: text,
      segments,
      meta: {
        hasImage: images.length > 0,
        imageUrls: images.map((x) => x.url),
        hasFile: files.length > 0,
        fileCount: files.length,
        hasCodeBlock: Boolean(node.querySelector('pre code')),
        hasCitations: /\[(\d+)\]/.test(rawText),
        citationCount: (rawText.match(/\[(\d+)\]/g) || []).length
      },
      raw_html: node.innerHTML
    };
  }

  function dedupeByContent(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.role}::${item.content}::${item.meta.imageUrls.join(',')}::${item.meta.fileCount}`;
      if (!item.content && !item.meta.hasImage && !item.meta.hasFile) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseGeminiChat() {
    const main = document.querySelector('[role="main"], main') || document.body;

    const primaryNodes = collectFromRoot(
      main,
      'user-query, model-response, [data-testid*="user" i], [data-testid*="model" i], [data-testid*="response" i]'
    );

    const fallbackNodes = primaryNodes.length
      ? []
      : collectFromRoot(main, 'article, section, div').filter((el) => {
          const t = (el.innerText || '').trim();
          return t.length > 20 && t.length < 15000 && (el.querySelector('img, pre code, a[href]') || t.includes('\n'));
        });

    const source = (primaryNodes.length ? primaryNodes : fallbackNodes).slice(0, 400);
    return dedupeByContent(source.map(mapMessageNode));
  }

  window.GeminiParser = { parseGeminiChat };
})();
