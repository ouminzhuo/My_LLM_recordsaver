const statusEl = document.getElementById('status');
const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');

let lastPayload = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#fca5a5' : '#d1d5db';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found.');
  return tab;
}

async function injectAndExtract(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['parsers/gemini.js', 'parsers/grok.js', 'parsers/chatgpt.js', 'content.js']
  });

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__multiLLMExtractor?.parseCurrentSiteChat?.()
  });

  if (!result?.result) {
    throw new Error('Extraction script did not return data.');
  }
  return result.result;
}

extractBtn.addEventListener('click', async () => {
  try {
    extractBtn.disabled = true;
    downloadBtn.disabled = true;
    setStatus('Extracting...');

    const tab = await getActiveTab();
    const payload = await injectAndExtract(tab.id);

    const serialized = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(serialized);

    lastPayload = payload;
    downloadBtn.disabled = false;

    const platformName = payload?.platform || 'Current site';
    const messageCount = payload?.messages?.length ?? 0;
    setStatus(`Success! ${platformName} chat copied (${messageCount} messages).`);
  } catch (error) {
    setStatus(`Failed: ${error.message}`, true);
  } finally {
    extractBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', async () => {
  if (!lastPayload) return;

  const blob = new Blob([JSON.stringify(lastPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[.:]/g, '-');
  a.href = url;
  a.download = `chat-export-${lastPayload.platform || 'unknown'}-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
