import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import { ApplicationError } from '@fbr/domain';
import type { Article } from '@fbr/contracts';

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 12_000;
export interface Address { address: string; family: 4 | 6; }
export interface Download { status: number; headers: Record<string, string | undefined>; body: string; }
export interface CaptureDependencies {
  resolve(host: string): Promise<Address[]>;
  download(url: URL, address: Address, remainingMs: number): Promise<Download>;
}
export interface ArticleCapture {
  url: string; captured_at: string; title: string; source_author: string; content: string; images: Article['source_images'];
}
export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.range() !== 'unicast') return false;
    if (parsed.kind() === 'ipv6') return parsed.match(ipaddr.parse('2000::'), 3);
    return !['192.0.0.0/24', '192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24', '198.18.0.0/15']
      .some(range => parsed.match(ipaddr.parseCIDR(range)));
  } catch { return false; }
}
export function validateCaptureUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new ApplicationError('validation', 'URL inválida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.hostname.endsWith('.')) {
    throw new ApplicationError('validation', 'Use URL HTTP/HTTPS pública, sem credenciais e com porta padrão.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || !host.includes('.') && !host.includes(':')) {
    throw new ApplicationError('validation', 'Endereço local não é permitido.');
  }
  if (ipaddr.isValid(host) && !isPublicAddress(host)) throw new ApplicationError('validation', 'Endereço interno ou reservado não é permitido.');
  url.hash = '';
  return url;
}

const defaults: CaptureDependencies = {
  async resolve(host) { return lookup(host, { all: true, verbatim: true }) as Promise<Address[]>; },
  download(url, address, remainingMs) {
    return new Promise((resolve, reject) => {
      const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = transport({
        protocol: url.protocol, hostname: address.address, family: address.family,
        port: url.protocol === 'https:' ? 443 : 80, method: 'GET', path: url.pathname + url.search,
        servername: url.hostname, agent: false,
        headers: { Host: url.host, Accept: 'text/html', 'Accept-Encoding': 'identity', 'User-Agent': 'FBRVideos/0.1 ArticleCapture' },
      }, res => {
        const headers = Object.fromEntries(Object.entries(res.headers).map(([key,value]) => [key, Array.isArray(value) ? value.join(',') : value]));
        if ([301,302,303,307,308].includes(res.statusCode ?? 0)) { res.destroy(); resolve({ status: res.statusCode!, headers, body: '' }); return; }
        if (Number(res.headers['content-length']) > MAX_BYTES || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
          res.destroy(); reject(new ApplicationError('ineligible', 'Página grande ou codificação não suportada. Cole o texto do artigo.')); return;
        }
        const chunks: Buffer[] = []; let bytes = 0;
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) { res.destroy(new ApplicationError('ineligible', 'Página excede o limite. Cole o texto do artigo.')); return; }
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString('utf8') }));
      });
      const timer = setTimeout(() => req.destroy(new ApplicationError('ineligible', 'A captura excedeu o prazo. Cole o texto do artigo.')), remainingMs);
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end();
    });
  },
};

export async function captureArticle(input: string, dependencies: CaptureDependencies = defaults): Promise<ArticleCapture> {
  let url = validateCaptureUrl(input);
  const deadline = Date.now() + TIMEOUT_MS;
  for (let redirects = 0; redirects <= 4; redirects++) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = await withDeadline(dependencies.resolve(host), deadline);
    if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new ApplicationError('validation', 'O destino resolve para endereço interno ou reservado.');
    const response = await withDeadline(dependencies.download(url, addresses[0]!, deadline - Date.now()), deadline);
    if ([301,302,303,307,308].includes(response.status)) {
      if (!response.headers.location || redirects === 4) throw new ApplicationError('ineligible', 'Redirecionamento inválido ou excessivo. Cole o texto do artigo.');
      let target: string;
      try { target = new URL(response.headers.location, url).href; } catch { throw new ApplicationError('validation', 'Redirecionamento inválido.'); }
      const next = validateCaptureUrl(target);
      if (url.protocol === 'https:' && next.protocol !== 'https:') throw new ApplicationError('validation', 'Redirecionamento para conexão sem proteção não é permitido.');
      url = next; continue;
    }
    if (response.status !== 200 || !/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(response.headers['content-type'] ?? '')
      || Buffer.byteLength(response.body) > MAX_BYTES) throw new ApplicationError('ineligible', 'A página não pode ser extraída. Cole o texto do artigo.');
    return extractArticle(response.body, url.href);
  }
  throw new ApplicationError('ineligible', 'Não foi possível capturar o artigo.');
}

async function withDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ApplicationError('ineligible', 'Prazo de captura excedido.')), Math.max(1, deadline - Date.now())); })]); }
  finally { if (timer) clearTimeout(timer); }
}
export function extractArticle(html: string, url: string): ArticleCapture {
  const $ = load(html);
  const title = $('meta[property="og:title"]').attr('content')?.trim() || $('h1').first().text().trim() || $('title').text().trim() || 'Captura para revisão';
  const source_author = $('meta[name="author"]').attr('content')?.trim() || $('[rel="author"]').first().text().trim() || 'Autoria não identificada';
  $('script,style,noscript,nav,header,footer,aside,form,iframe,button,[hidden]').remove();
  const root = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
  // Read each text node once. Selecting both a list/quote and its paragraphs
  // duplicates content and can change the argument used by the planner.
  const paragraphs: string[] = [];
  const contentNodes = root.contents().toArray();
  const boundaries = new Set(['h1','h2','h3','h4','h5','h6','p','li','blockquote',
    'div','section','article','main','ul','ol','table','tr','td','th','pre']);
  let pending = '';
  const flush = () => {
    const text = pending.replace(/\s+/g, ' ').trim();
    if (text) paragraphs.push(text);
    pending = '';
  };
  const visit = (node: (typeof contentNodes)[number]): void => {
    if (node.type === 'text') { pending += node.data; return; }
    if (!('children' in node)) return;
    const name = 'name' in node ? node.name.toLowerCase() : '';
    if (name === 'br') { pending += '\n'; return; }
    const boundary = boundaries.has(name);
    if (boundary) flush();
    for (const child of node.children) visit(child);
    if (boundary) flush();
  };
  for (const node of contentNodes) visit(node);
  flush();
  const content = (paragraphs.length ? paragraphs.join('\n\n') : root.text().replace(/\s+/g, ' ').trim()).slice(0, 500_000);
  if (!content || content.length < 40) throw new ApplicationError('ineligible', 'Conteúdo insuficiente. Cole o texto completo do artigo.');
  const images: Article['source_images'] = [];
  root.find('img[src]').each((_, image) => {
    try {
      const uri = new URL($(image).attr('src')!, url);
      if (['http:', 'https:'].includes(uri.protocol) && !uri.username && !uri.password && !images.some(i => i.uri === uri.href)) {
        images.push({ uri: uri.href, usage_permission: 'unknown', evidence: null });
      }
    } catch { /* Imagens inválidas não são usadas como referências. */ }
  });
  return { url, title: title.slice(0,500), source_author: source_author.slice(0,300), content, images: images.slice(0,100), captured_at: new Date().toISOString() };
}
