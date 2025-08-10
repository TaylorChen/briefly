function getStorage(key) {
  return new Promise((resolve) => chrome.storage.sync.get(key, (res) => resolve(res[key])));
}
function setStorage(obj) {
  return new Promise((resolve) => chrome.storage.sync.set(obj, () => resolve()));
}

const els = {
  provider: document.getElementById('provider'),
  btnSummarize: document.getElementById('btnSummarize'),
  btnRegenerate: document.getElementById('btnRegenerate'),
  btnOpenHistory: document.getElementById('btnOpenHistory'),
  btnCopy: document.getElementById('btnCopy'),
  status: document.getElementById('status'),
  result: document.getElementById('result'),
  userHint: document.getElementById('userHint'),
  openOptions: document.getElementById('openOptions'),
  openOptions2: document.getElementById('openOptions2'),
  configHint: document.getElementById('configHint'),
  progressWrap: document.getElementById('progressWrap'),
  progressInner: document.getElementById('progressInner'),
  progressText: document.getElementById('progressText'),
};

let currentTab = null;
let currentTabUrl = '';
let currentTabTitle = '';
let lastMarkdown = '';

function isSummarizableUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return true;
  return false;
}

async function loadSettings() {
  const settings = (await getStorage('settings')) || {};
  els.provider.value = settings.provider || 'deepseek';
  const hasKey = (settings.provider === 'deepseek' && settings.deepseekKey) || (settings.provider === 'qwen' && settings.qwenKey);
  els.configHint.style.display = hasKey ? 'none' : 'block';
}

function uiLoading(on) {
  els.btnSummarize.disabled = on;
  els.btnRegenerate.disabled = on;
  els.status.textContent = on ? '处理中…' : '';
  els.progressWrap.style.display = on ? 'block' : 'none';
}

function setProgress(pct, text) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  els.progressInner.style.width = `${clamped}%`;
  els.progressText.textContent = `${clamped}%${text ? ` · ${text}` : ''}`;
}

function renderMarkdown(md) {
  // 直接以 Markdown 文本显示，不做结构化改写；基础安全转义交给浏览器 pre/code 样式或三方渲染器，当前直接 innerText
  // 由于不引入库，这里用 <pre> 容器来展示原始 Markdown 文本
  els.result.textContent = md || '';
}

async function ensureTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id && isSummarizableUrl(active.url || '')) {
    currentTab = active; currentTabUrl = active.url || ''; currentTabTitle = active.title || '';
    return;
  }
  const all = await chrome.tabs.query({ currentWindow: true });
  const candidate = all.find((t) => isSummarizableUrl(t.url || ''));
  if (candidate?.id) {
    currentTab = candidate; currentTabUrl = candidate.url || ''; currentTabTitle = candidate.title || '';
    return;
  }
  throw new Error('请在普通网页（http/https）中使用该功能');
}

async function trySendMessage(msg) {
  if (!isSummarizableUrl(currentTabUrl)) {
    throw new Error('当前页面不支持注入，请切换到普通网页');
  }
  try {
    return await chrome.tabs.sendMessage(currentTab.id, msg);
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['content_script.js'] });
    return await chrome.tabs.sendMessage(currentTab.id, msg);
  }
}

async function extractPage() {
  setProgress(20, '提取网页内容');
  await ensureTab();
  const extract = await trySendMessage({ type: 'EXTRACT_CONTENT' });
  if (!extract?.ok) throw new Error(extract?.error || '提取内容失败');
  setProgress(40, '提取完成');
  return extract.data;
}

async function summarize({ userHint } = {}) {
  uiLoading(true);
  setProgress(10, '开始');
  renderMarkdown('');
  try {
    const settings = (await getStorage('settings')) || {};
    const provider = els.provider.value || settings.provider || 'deepseek';
    const model = provider === 'deepseek' ? (settings.deepseekModel || 'deepseek-chat') : (settings.qwenModel || 'qwen2.5-7b-instruct');
    const apiKey = provider === 'deepseek' ? settings.deepseekKey : settings.qwenKey;
    if (!apiKey) throw new Error('未配置 API Key，请前往设置页');

    const { title, url, text } = await extractPage();
    setProgress(60, '调用模型');
    const payload = { type: 'SUMMARIZE_CONTENT', payload: { provider, model, apiKey, content: text, title, url, language: 'zh', userHint: userHint || '' } };
    const res = await new Promise((resolve) => chrome.runtime.sendMessage(payload, resolve));
    if (!res?.ok) throw new Error(res?.error || '调用模型失败');

    setProgress(90, '生成摘要');
    lastMarkdown = res.data || '';
    renderMarkdown(lastMarkdown);
    els.btnCopy.disabled = !lastMarkdown;
    setProgress(100, '完成');
  } catch (err) {
    renderMarkdown(`出错：${(err?.message || String(err))}`);
    setProgress(100, '失败');
  } finally {
    setTimeout(() => uiLoading(false), 500);
  }
}

async function init() {
  await loadSettings();

  els.provider.addEventListener('change', async () => {
    const settings = (await getStorage('settings')) || {};
    const next = { ...settings, provider: els.provider.value };
    await setStorage({ settings: next });
  });

  els.btnSummarize.addEventListener('click', () => summarize());
  els.btnRegenerate.addEventListener('click', () => summarize({ userHint: els.userHint.value }));
  els.btnOpenHistory?.addEventListener('click', async () => {
    try { await ensureTab(); } catch (_) {}
    const base = chrome.runtime.getURL('history.html');
    const u = `${base}?url=${encodeURIComponent(currentTabUrl || '')}&title=${encodeURIComponent(currentTabTitle || '')}`;
    chrome.tabs.create({ url: u });
  });
  els.btnCopy.addEventListener('click', async () => {
    if (!lastMarkdown) return;
    try {
      await navigator.clipboard.writeText(lastMarkdown);
      els.status.textContent = '已复制';
      setTimeout(() => (els.status.textContent = ''), 1200);
    } catch (e) {
      els.status.textContent = '复制失败';
      setTimeout(() => (els.status.textContent = ''), 1200);
    }
  });
  const openOps = () => chrome.runtime.openOptionsPage();
  els.openOptions?.addEventListener('click', openOps);
  els.openOptions2?.addEventListener('click', openOps);
}

init();
