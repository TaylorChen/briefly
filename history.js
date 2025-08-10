function renderMarkdownInto(el, md) {
  el.textContent = md || '';
}

async function getPageHistory(url) {
  return await new Promise((resolve) => chrome.runtime.sendMessage({ type: 'GET_PAGE_HISTORY', payload: { url } }, resolve));
}

async function resolveTargetUrl() {
  const urlParam = new URL(location.href).searchParams.get('url');
  if (urlParam) return urlParam;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || '';
}

async function init() {
  const meta = document.getElementById('meta');
  const list = document.getElementById('list');

  const url = await resolveTargetUrl();
  meta.textContent = url ? `当前页面：${url}` : '无法获取当前页面 URL';

  const res = await getPageHistory(url);
  if (!res?.ok) {
    list.innerHTML = `<div class="item">读取历史失败：${res?.error || '未知错误'}</div>`;
    return;
  }
  const items = res.data || [];
  if (items.length === 0) {
    list.innerHTML = `<div class="item">暂无历史记录</div>`;
    return;
  }
  list.innerHTML = items.map((r, idx) => `
    <div class="item">
      <div class="head">
        <span>#${idx + 1}</span>
        <span>${new Date(r.updatedAt).toLocaleString()}</span>
        <div class="spacer"></div>
        <button class="copy" data-idx="${idx}">复制</button>
      </div>
      <pre class="md"></pre>
    </div>
  `).join('');

  const mdEls = list.querySelectorAll('pre.md');
  mdEls.forEach((pre, i) => renderMarkdownInto(pre, items[i]?.markdown || ''));

  list.querySelectorAll('button.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.idx);
      const md = items[i]?.markdown || '';
      try {
        await navigator.clipboard.writeText(md);
        btn.textContent = '已复制';
        setTimeout(() => (btn.textContent = '复制'), 1200);
      } catch (_) {
        btn.textContent = '复制失败';
        setTimeout(() => (btn.textContent = '复制'), 1200);
      }
    });
  });
}

init();
