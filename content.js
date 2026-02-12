(function bootstrapExtractor() {
  function detectPlatformByUrl(locationLike = window.location) {
    const host = locationLike.hostname;
    const path = locationLike.pathname || '';

    if (host === 'gemini.google.com') return 'gemini';
    if (host === 'grok.com' || (host === 'x.com' && path.startsWith('/i/grok'))) return 'grok';
    if (host === 'chatgpt.com' || host === 'chat.openai.com') return 'chatgpt';
    return 'unsupported';
  }

  function normalizeResult(platform, messages, warnings = []) {
    return {
      platform,
      extractedAt: new Date().toISOString(),
      warnings,
      messages
    };
  }

  function parseCurrentSiteChat() {
    const platform = detectPlatformByUrl(window.location);
    switch (platform) {
      case 'gemini':
        return normalizeResult(platform, window.GeminiParser.parseGeminiChat());
      case 'grok':
        return normalizeResult(platform, window.GrokParser.parseGrokChat());
      case 'chatgpt':
        return normalizeResult(platform, window.ChatGPTParser.parseChatGPTChat());
      default:
        throw new Error('Unsupported site. Supported: Gemini / Grok / ChatGPT.');
    }
  }

  window.__multiLLMExtractor = {
    detectPlatformByUrl,
    parseCurrentSiteChat
  };
})();
