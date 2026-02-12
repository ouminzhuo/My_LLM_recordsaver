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
    let messages = [];

    switch (platform) {
      case 'gemini':
        messages = window.GeminiParser.parseGeminiChat();
        break;
      case 'grok':
        messages = window.GrokParser.parseGrokChat();
        break;
      case 'chatgpt':
        messages = window.ChatGPTParser.parseChatGPTChat();
        break;
      default:
        throw new Error('Unsupported site. Supported: Gemini / Grok / ChatGPT.');
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error(`Parser matched 0 messages on ${platform}.`);
    }

    return normalizeResult(platform, messages);
  }

  window.__multiLLMExtractor = {
    detectPlatformByUrl,
    parseCurrentSiteChat
  };
})();
