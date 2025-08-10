function getStorage(key) {
  return new Promise((resolve) => chrome.storage.sync.get(key, (res) => resolve(res[key])));
}
function setStorage(obj) {
  return new Promise((resolve) => chrome.storage.sync.set(obj, () => resolve()));
}

const els = {
  provider: document.getElementById('provider'),
  deepseekKey: document.getElementById('deepseekKey'),
  qwenKey: document.getElementById('qwenKey'),
  deepseekModel: document.getElementById('deepseekModel'),
  qwenModel: document.getElementById('qwenModel'),
  btnSave: document.getElementById('btnSave'),
  status: document.getElementById('status'),
};

async function load() {
  const settings = (await getStorage('settings')) || {};
  els.provider.value = settings.provider || 'deepseek';
  els.deepseekKey.value = settings.deepseekKey || '';
  els.qwenKey.value = settings.qwenKey || '';
  els.deepseekModel.value = settings.deepseekModel || 'deepseek-chat';
  els.qwenModel.value = settings.qwenModel || 'qwen2.5-7b-instruct';
}

async function save() {
  const next = {
    provider: els.provider.value,
    deepseekKey: els.deepseekKey.value.trim(),
    qwenKey: els.qwenKey.value.trim(),
    deepseekModel: els.deepseekModel.value.trim() || 'deepseek-chat',
    qwenModel: els.qwenModel.value.trim() || 'qwen2.5-7b-instruct',
  };
  await setStorage({ settings: next });
  els.status.textContent = '已保存';
  setTimeout(() => (els.status.textContent = ''), 1500);
}

els.btnSave.addEventListener('click', save);
load();
