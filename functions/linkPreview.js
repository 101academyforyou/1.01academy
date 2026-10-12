/* 循序漸進學伊斯蘭：貼上文章連結時，讀取那個網頁的標題、摘要、封面圖片，幫管理者自動填好文章資料
 *
 * 瀏覽器不能直接讀別的網站（CORS），所以由這裡代為讀取。
 * 安全：只有伊斯蘭網站的管理者能用；只接受 http/https 和預設連接埠；不連內部網路位址；有大小與時間上限。
 */
const dns = require('dns').promises;
const net = require('net');

const ISLAM_ADMINS = ['salimachchang@gmail.com', '1.01academyforyou@gmail.com', 'nadiamai@gmail.com', 'colorful6dorie@gmail.com'];
const MAX_HTML = 3 * 1024 * 1024;
const MAX_IMAGE = 4 * 1024 * 1024;
const TIMEOUT = 10000;
const UA = 'Mozilla/5.0 (compatible; IslamCourseLinkPreview/1.0; +https://islam.onepointzeroone.org)';

// 內部、保留位址（防止被拿來掃描伺服器內網）
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') ||
    v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

async function checkUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { throw new Error('網址格式不正確'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('只支援 http 或 https 網址');
  if (u.username || u.password) throw new Error('網址格式不正確');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('不支援這個連接埠');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$/i.test(host) || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('不支援這個網址');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw new Error('找不到這個網站'); });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('不支援這個網址');
  return u;
}

// 讀取網址（手動處理轉址，每一次都重新檢查位址）
async function safeFetch(raw, max, accept) {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await checkUrl(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    let res;
    try {
      res = await fetch(u, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': UA, accept, 'accept-language': 'zh-TW,zh;q=0.9,en;q=0.6' } });
    } catch (e) {
      clearTimeout(timer);
      throw new Error(e.name === 'AbortError' ? '網站回應太慢，請稍後再試' : '無法連到這個網站');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(timer);
      url = new URL(res.headers.get('location'), u).href;
      continue;
    }
    if (!res.ok) { clearTimeout(timer); throw new Error(`網站回應錯誤（${res.status}）`); }
    const len = Number(res.headers.get('content-length') || 0);
    if (len > max) { clearTimeout(timer); ctrl.abort(); throw new Error('檔案太大'); }
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of res.body) {
        size += chunk.length;
        if (size > max) { ctrl.abort(); throw new Error('檔案太大'); }
        chunks.push(chunk);
      }
    } finally { clearTimeout(timer); }
    return { url: u.href, type: res.headers.get('content-type') || '', body: Buffer.concat(chunks) };
  }
  throw new Error('轉址太多次');
}

// ---------- 解析 HTML ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decodeEntities = (s) => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
  if (e[0] === '#') {
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});
const clean = (s) => decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function decodeHtml(buf, contentType) {
  const head = buf.subarray(0, 4096).toString('latin1');
  const charset = (/charset=["']?([\w-]+)/i.exec(contentType) || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1] || 'utf-8';
  const name = charset.toLowerCase() === 'gb2312' ? 'gbk' : charset.toLowerCase();
  try { return new TextDecoder(name).decode(buf); } catch (e) { return new TextDecoder('utf-8').decode(buf); }
}

function attrsOf(tag) {
  const out = {};
  tag.replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, k, __, a, b, c) => { out[k.toLowerCase()] = a ?? b ?? c ?? ''; return ''; });
  return out;
}

function parsePage(html, pageUrl) {
  const metas = {};
  (html.match(/<meta\b[^>]*>/gi) || []).forEach((tag) => {
    const a = attrsOf(tag);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && !(key in metas)) metas[key] = decodeEntities(a.content).trim();
  });
  const abs = (u) => { try { return u ? new URL(decodeEntities(u).trim(), pageUrl).href : ''; } catch (e) { return ''; } };
  const siteName = metas['og:site_name'] || '';
  let title = metas['og:title'] || metas['twitter:title'] || clean((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]) ||
    clean((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1]);
  // 去掉標題後面的網站名稱（例如「文章標題 - 網站名稱」）
  const parts = title.split(/\s+[-–—]\s+|\s*[|｜_]\s*/);
  if (parts.length > 1 && parts[0].length >= 4) title = parts[0];
  let summary = metas['og:description'] || metas['twitter:description'] || metas.description || '';
  // 正文：去掉 script、style、導覽列等，取第一段夠長的文字當摘要
  const body = html.replace(/<(script|style|noscript|nav|header|footer|form|iframe|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  if (!summary) {
    const paras = (body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map(clean).filter((t) => t.length >= 30);
    summary = paras[0] || '';
  }
  if (summary.length > 160) summary = summary.slice(0, 157) + '…';
  let image = abs(metas['og:image'] || metas['og:image:url'] || metas['twitter:image'] || metas['twitter:image:src']);
  if (!image) {
    // 沒有 og:image：取正文第一張不像 logo、圖示的圖片
    const img = (body.match(/<img\b[^>]*>/gi) || []).map(attrsOf)
      .map((a) => a['data-src'] || a.src)
      .find((src) => src && !/logo|icon|banner|button|spacer|blank|avatar|qr|\.svg|\.gif/i.test(src));
    image = abs(img);
  }
  return { title: title.slice(0, 200), summary, image, siteName };
}

async function preview(url) {
  const page = await safeFetch(url, MAX_HTML, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5');
  if (!/html|xml/i.test(page.type) && !/^\s*</.test(page.body.subarray(0, 200).toString())) throw new Error('這個網址不是網頁');
  const info = parsePage(decodeHtml(page.body, page.type), page.url);
  let image = null;
  if (info.image) {
    try {
      const img = await safeFetch(info.image, MAX_IMAGE, 'image/*');
      const type = (img.type.split(';')[0] || '').trim();
      if (/^image\/(jpeg|png|gif|webp)$/.test(type)) image = { type, data: img.body.toString('base64') };
    } catch (e) { /* 封面圖片讀不到就略過 */ }
  }
  return { url: page.url, title: info.title, summary: info.summary, siteName: info.siteName, image };
}

module.exports = { ISLAM_ADMINS, preview, parsePage, decodeHtml, isPrivateIp, checkUrl };
