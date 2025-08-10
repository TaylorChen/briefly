// Background Service Worker for Briefly

const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  deepseekModel: 'deepseek-chat',
  qwenModel: 'qwen2.5-7b-instruct',
};

const PROVIDERS = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    path: '/chat/completions',
    formatHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    path: '/chat/completions',
    formatHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
};

function getSync(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (res) => resolve(res[key]));
  });
}
function setSync(obj) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(obj, () => resolve());
  });
}
function getLocal(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res[key]));
  });
}
function setLocal(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve());
  });
}

async function getSettings() {
  const settings = (await getSync('settings')) || {};
  return { ...DEFAULT_SETTINGS, ...settings };
}

function normalizeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    let path = u.pathname || '/';
    path = path.replace(/\/+$/, '');
    if (path === '') path = '/';
    return `${u.origin}${path}`;
  } catch (_) {
    return urlStr;
  }
}

function normalizeTitle(title) {
  return (title || '').trim().toLowerCase();
}

function buildPrompt({ content, title, url, userHint, language }) {
  const localeInstruction = language === 'zh'
    ? '请用 Markdown 输出摘要，使用合适的标题、列表、分段与强调，简洁准确，勿添加额外装饰。'
    : 'Please output the summary in Markdown with headings, lists and clear sections.';
  const custom = userHint?.trim() ? `\n额外要求：${userHint.trim()}` : '';
  return `你是一个高质量摘要助手。\n\n网页标题: ${title || ''}\nURL: ${url || ''}\n\n正文：\n${content}\n\n${localeInstruction}${custom}`;
}

async function callChatAPI({ provider, apiKey, model, prompt }) {
  const config = PROVIDERS[provider];
  if (!config) throw new Error(`不支持的供应商: ${provider}`);
  if (!apiKey) throw new Error('缺少 API Key');
  if (!model) throw new Error('缺少模型名称');

  const url = `${config.baseUrl}${config.path}`;
  const body = {
    model,
    messages: [
      { role: 'system', content: '你是一个中文摘要助手。输出使用 Markdown。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  };

  const headers = {
    'Content-Type': 'application/json',
    ...config.formatHeaders(apiKey),
  };

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`请求失败 ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('模型未返回内容');
  return content.trim();
}

async function getCacheFor(url, title) {
  const [byExact, byNorm, byOriginTitle, history] = await Promise.all([
    getLocal('summaries'),
    getLocal('summariesByNorm'),
    getLocal('summariesByOriginTitle'),
    getLocal('summariesHistory'),
  ]);
  const exactMap = byExact || {};
  const normMap = byNorm || {};
  const originTitleMap = byOriginTitle || {};
  const hist = Array.isArray(history) ? history : [];

  if (exactMap[url]) return exactMap[url];

  const norm = normalizeUrl(url);
  if (normMap[norm]) return normMap[norm];

  try {
    const u = new URL(url);
    const key = `${u.host}|${normalizeTitle(title)}`;
    if (originTitleMap[key]) return originTitleMap[key];
  } catch (_) {}

  const fromHistNorm = hist.find((r) => r && normalizeUrl(r.url) === norm);
  if (fromHistNorm) return fromHistNorm;

  try {
    const u = new URL(url);
    const candidates = hist.filter((r) => {
      try { return new URL(r.url).host === u.host && (title ? normalizeTitle(r.title) === normalizeTitle(title) : true); } catch (_) { return false; }
    });
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return candidates[0];
    }
  } catch (_) {}

  if (hist.length > 0) {
    const sorted = [...hist].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sorted[0];
  }

  return null;
}

async function getPageHistory(url) {
  const history = (await getLocal('summariesHistory')) || [];
  const norm = normalizeUrl(url);
  const list = (Array.isArray(history) ? history : [])
    .filter((r) => r && normalizeUrl(r.url) === norm)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5);
  return list;
}

async function setCacheFor(url, record) {
  const [byExact, byNorm, byOriginTitle, history] = await Promise.all([
    getLocal('summaries'),
    getLocal('summariesByNorm'),
    getLocal('summariesByOriginTitle'),
    getLocal('summariesHistory'),
  ]);
  const exactMap = byExact || {};
  const normMap = byNorm || {};
  const originTitleMap = byOriginTitle || {};
  const hist = Array.isArray(history) ? history : [];

  const norm = normalizeUrl(url);
  let host = '';
  try { host = new URL(url).host; } catch (_) { host = ''; }
  const keyOriginTitle = host ? `${host}|${normalizeTitle(record.title)}` : '';

  exactMap[url] = record;
  normMap[norm] = record;
  if (keyOriginTitle) originTitleMap[keyOriginTitle] = record;

  const isSameEntry = (a, b) => normalizeUrl(a.url) === normalizeUrl(b.url)
    && (a.markdown || '') === (b.markdown || '')
    && (a.userHint || '') === (b.userHint || '')
    && (a.model || '') === (b.model || '')
    && (a.provider || '') === (b.provider || '');

  const deduped = [record, ...hist.filter((r) => !isSameEntry(r, record))];
  const trimmed = deduped.slice(0, 500);

  await setLocal({
    summaries: exactMap,
    summariesByNorm: normMap,
    summariesByOriginTitle: originTitleMap,
    summariesHistory: trimmed,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'GET_CACHED_SUMMARY') {
        const { url, title } = message.payload || {};
        const cached = await getCacheFor(url, title);
        sendResponse({ ok: true, data: cached || null });
        return;
      }

      if (message?.type === 'GET_PAGE_HISTORY') {
        const { url } = message.payload || {};
        const list = await getPageHistory(url);
        sendResponse({ ok: true, data: list });
        return;
      }

      if (message?.type === 'SUMMARIZE_CONTENT') {
        const {
          provider: providerIn,
          model: modelIn,
          apiKey: apiKeyIn,
          content,
          language = 'zh',
          title,
          url,
          userHint,
        } = message.payload || {};

        const settings = await getSettings();
        const provider = providerIn || settings.provider || 'deepseek';
        const model = modelIn || (provider === 'deepseek' ? settings.deepseekModel : settings.qwenModel);
        const apiKey = apiKeyIn || (provider === 'deepseek' ? settings.deepseekKey : settings.qwenKey);

        const prompt = buildPrompt({ content, title, url, userHint, language });
        const md = await callChatAPI({ provider, apiKey, model, prompt });

        const record = { url, title, provider, model, userHint: userHint || '', markdown: md, updatedAt: Date.now() };
        await setCacheFor(url, record);
        sendResponse({ ok: true, data: md, meta: { cached: true, updatedAt: record.updatedAt } });
        return;
      }

      sendResponse({ ok: false, error: '未知消息类型' });
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();
  return true;
});
