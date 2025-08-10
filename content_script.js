// Content Script for Briefly

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[\t\r]+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMainNode() {
  const candidates = Array.from(document.querySelectorAll(
    'article, main, [role="main"], .content, #content, .post, .article, .post-content, .entry-content'
  ));
  if (candidates.length > 0) {
    // choose the node with the most textContent length
    candidates.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length);
    return candidates[0];
  }
  return document.body;
}

function stripUnwanted(node) {
  const cloned = node.cloneNode(true);
  const selectors = [
    'script',
    'style',
    'noscript',
    'svg',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    'iframe',
    'button',
    'input',
  ];
  for (const sel of selectors) {
    cloned.querySelectorAll(sel).forEach((el) => el.remove());
  }
  return cloned;
}

function extractContent() {
  const node = extractMainNode();
  const cleanNode = stripUnwanted(node);
  let text = cleanText(cleanNode.innerText || cleanNode.textContent || '');
  if (!text || text.length < 200) {
    const bodyClone = stripUnwanted(document.body);
    text = cleanText(bodyClone.innerText || bodyClone.textContent || '');
  }
  const maxLen = 15000; // avoid oversized payload
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return {
    title: document.title || '',
    url: location.href,
    text,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'EXTRACT_CONTENT') {
    try {
      const data = extractContent();
      sendResponse({ ok: true, data });
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
    return true;
  }
});
