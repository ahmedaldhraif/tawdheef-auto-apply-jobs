/** Local tracker configuration; external tools and authentication belong to the actual client. */
import { readFile, access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultDataDir } from '../scripts/app-paths.mjs';
export const INTEGRATIONS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TABBIO_MCP_URL = 'https://server.tabbio.com/api/mcp';
/**
 * The Tabbio MCP endpoint written into client settings. The published one by
 * default; TAWDHEEF_TABBIO_MCP_URL points a developer's setup at another
 * Tabbio environment (for example its staging server). Only an https URL, or
 * http on this computer, whose path is a Tabbio MCP path.
 */
export function tabbioMcpUrl(env = process.env) {
  const raw = env.TAWDHEEF_TABBIO_MCP_URL?.trim();
  if (!raw) return TABBIO_MCP_URL;
  let url;
  try { url = new URL(raw); } catch { throw new Error('TAWDHEEF_TABBIO_MCP_URL must be a full URL, for example https://server.tabbio.com/api/mcp.'); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) throw new Error('TAWDHEEF_TABBIO_MCP_URL must use https (http only on this computer).');
  // A Tabbio host (production or staging) or this computer: the agent is told to sign in there.
  const tabbioHost = /^([a-z0-9-]+\.)*tabbio\.(com|dev)$/.test(url.hostname);
  if (!tabbioHost && !loopback) throw new Error('TAWDHEEF_TABBIO_MCP_URL must be a Tabbio host (tabbio.com or tabbio.dev) or this computer.');
  // The only query allowed is Tawdheef's own marker on the sign-up door (setup adds it).
  const marker = url.search === '?client=tawdheef' && url.pathname.replace(/\/$/, '').endsWith('/api/mcp/start');
  if (url.username || url.password || (url.search && !marker) || url.hash) throw new Error('TAWDHEEF_TABBIO_MCP_URL must not contain credentials, a query or a fragment.');
  if (!/^\/api\/mcp(\/start)?$/.test(url.pathname.replace(/\/$/, ''))) throw new Error('TAWDHEEF_TABBIO_MCP_URL must end in /api/mcp or /api/mcp/start.');
  return withTawdheefMarker(`${url.origin}${url.pathname.replace(/\/$/, '')}`);
}

/**
 * The door is told the setup came from Tawdheef (`?client=tawdheef`), so the
 * key it makes is named "Tawdheef" in the person's Tabbio settings whichever
 * client runs it (one place, one name). The published /api/mcp is unchanged.
 */
function withTawdheefMarker(url) {
  return url.endsWith('/api/mcp/start') ? `${url}?client=tawdheef` : url;
}

/** True for Tabbio's in-chat sign-up door, with or without its marker. */
export function isTabbioSignupUrl(url) {
  try { return new URL(url).pathname.replace(/\/$/, '').endsWith('/api/mcp/start'); } catch { return false; }
}

/** Tabbio's in-chat sign-up and sign-in door (off until Tabbio turns it on). */
export const TABBIO_SIGNUP_MCP_URL = 'https://server.tabbio.com/api/mcp/start?client=tawdheef';
const TERMS_URL = 'https://tabbio.com/en/terms-of-service';
const PRIVACY_URL = 'https://tabbio.com/en/privacy-policy';
export const TABBIO_TERMS_LINE = `Using Tabbio through Tawdheef means you accept Tabbio's Terms of Service (${TERMS_URL}) and Privacy Policy (${PRIVACY_URL}).`;

/**
 * The Tabbio MCP URL setup writes. A developer override wins. Otherwise, when
 * asked to probe, one anonymous request checks whether Tabbio's sign-up door
 * answers: if it does, the door is written, so someone with no Tabbio token
 * can create an account or sign in from inside the chat with an emailed code;
 * if not (or offline), the published endpoint with the client's own browser
 * sign-in, exactly as before. Nothing about the person is sent.
 */
export async function resolveTabbioMcpUrl({ env = process.env, probe = false, fetch: fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  if (env.TAWDHEEF_TABBIO_MCP_URL?.trim()) return tabbioMcpUrl(env);
  if (!probe || typeof fetchImpl !== 'function') return TABBIO_MCP_URL;
  try {
    const response = await fetchImpl(TABBIO_SIGNUP_MCP_URL, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tawdheef-setup', version: '1' } } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) { await response.body?.cancel?.().catch(() => {}); return TABBIO_MCP_URL; }
    // Only a real MCP answer from Tabbio counts (not a captive portal's 200 page).
    const text = (await response.text()).slice(0, 20_000);
    const line = text.split('\n').find(row => row.startsWith('data:'));
    let answer = null;
    try { answer = JSON.parse(line ? line.slice(5) : text); } catch { return TABBIO_MCP_URL; }
    return /tabbio/i.test(String(answer?.result?.serverInfo?.name ?? '')) ? TABBIO_SIGNUP_MCP_URL : TABBIO_MCP_URL;
  } catch {
    return TABBIO_MCP_URL;
  }
}
function locations(options = {}) {
  const root = resolve(options.root || INTEGRATIONS_ROOT);
  const dataDir = resolve(options.dataDir || defaultDataDir(root));
  const port = Number(options.port || process.env.APPLY_TRACKER_PORT || 4000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a port from 1024 to 65535.');
  return { root, dataDir, port };
}

async function runningApp({ dataDir, port }) {
  const url = `http://127.0.0.1:${port}`;
  try {
    const health = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    const body = await health.json();
    if (!health.ok || body.app !== 'apply-tracker' || body.ok !== true) return { running: false, sameDataDirectory: false, url };
    const configResponse = await fetch(`${url}/api/agent-config`, { signal: AbortSignal.timeout(1500) });
    const config = await configResponse.json();
    const actualData = config.mcpServers?.['apply-tracker']?.env?.APPLY_TRACKER_DATA;
    return { running: true, sameDataDirectory: Boolean(actualData && resolve(actualData) === dataDir), url };
  } catch { return { running: false, sameDataDirectory: false, url }; }
}


export async function integrationStatus(options = {}) {
  const paths = locations(options);
  return { mode: 'native', owner: 'selected_ai_client',
    runtime: { node: process.version, supported: Number(process.versions.node.split('.')[0]) >= 24, platform: process.platform, architecture: process.arch },
    app: await runningApp(paths), integrations: [], accountConnected: false,
    nextStep: 'Check the connections actually available in your Codex or Claude Code client. Tawdheef keeps local guidance, scope and recorded outcomes.' };
}
/** Config generation is read-only. Optional servers are included only by name. */
export async function createClientConfig(options = {}) {
  if (options.localAdapters || (options.mode && options.mode !== 'native')) throw new Error('App-managed adapters have been retired. Use your actual Codex or Claude Code client.');
  const mode = 'native';
  if (options.assistant !== undefined && !['codex', 'claude-code'].includes(options.assistant)) throw new Error('Choose Codex or Claude Code for the client configuration.');
  if (options.monitor !== undefined && typeof options.monitor !== 'boolean') throw new Error('monitor must be true or false.');
  if (options.monitorAssistant !== undefined && !['codex', 'claude-code'].includes(options.monitorAssistant)) throw new Error('Choose a supported monitoring assistant.');
  if (options.monitor && !options.monitorAssistant) throw new Error('Choose the selected monitoring assistant for this dedicated workspace.');
  if (options.monitor && options.include?.length) throw new Error('The monitoring workspace uses native read tools; application browser servers belong in the ordinary workspace.');
  const { root, dataDir, port } = locations(options);
  const include = options.include || [];
  if (!Array.isArray(include) || include.some(id => id !== 'tabbio')) throw new Error('Use your actual client’s native browser, email and calendar tools. Only direct Tabbio MCP can be selected here.');
  const assistant = options.assistant || options.monitorAssistant || 'codex';
  const mcpServers = {
    'apply-tracker': { command: process.execPath, args: [join(root, 'server', 'mcp.mjs')], env: { APPLY_TRACKER_DATA: dataDir, APPLY_TRACKER_PORT: String(port), APPLY_TRACKER_CONNECTION_MODE: mode, APPLY_TRACKER_CLIENT: assistant } },
  };
  const tabbioUrl = options.tabbioMcpUrl ? tabbioMcpUrl({ TAWDHEEF_TABBIO_MCP_URL: options.tabbioMcpUrl }) : tabbioMcpUrl();
  for (const id of new Set(include)) mcpServers[id] = { url: tabbioUrl };
  if (options.monitor) mcpServers['apply-tracker'].env.APPLY_TRACKER_MONITOR = '1';
  if (options.monitor && options.monitorAssistant) mcpServers['apply-tracker'].env.APPLY_TRACKER_MONITOR_ASSISTANT = options.monitorAssistant;
  const forClient = client => Object.fromEntries(Object.entries(mcpServers).map(([name, server]) => [name, server.env ? { ...server, env: { ...server.env, APPLY_TRACKER_CLIENT: client, ...(options.monitor ? { APPLY_TRACKER_MONITOR_ASSISTANT: client } : {}) } } : { ...server }]));
  const tomlString = value => JSON.stringify(String(value));
  const codexToml = Object.entries(forClient('codex')).map(([name, server]) => [
    `[mcp_servers.${name}]`, ...(server.url ? [`url = ${tomlString(server.url)}`] : [`command = ${tomlString(server.command)}`, `args = ${JSON.stringify(server.args)}`]),
    ...(server.env ? ['', `[mcp_servers.${name}.env]`, ...Object.entries(server.env).map(([key, value]) => `${key} = ${tomlString(value)}`)] : []),
  ].join('\n')).join('\n\n') + '\n';
  const claudeJson = JSON.stringify({ mcpServers: Object.fromEntries(Object.entries(forClient('claude-code')).map(([name, entry]) => [name, { type: entry.url ? 'http' : 'stdio', ...entry }])) }, null, 2) + '\n';
  const selectedServers = assistant === 'claude-code' ? Object.fromEntries(Object.entries(forClient(assistant)).map(([name, server]) => [name, server.url ? { type: 'http', ...server } : server])) : mcpServers;
  return { mode, assistant, mcpServers: selectedServers, codexToml, claudeJson, included: Object.keys(mcpServers), accountConnected: false };
}

export async function exportClientConfig(directory, options = {}) {
  if (typeof directory !== 'string' || !directory.trim()) throw new Error('Choose an output directory for the generated client configuration.');
  const output = resolve(directory);
  const config = await createClientConfig(options);
  await mkdir(output, { recursive: true });
  // Exclusive writes never replace a user's existing AI-client configuration.
  const files = [join(output, 'codex-mcp.toml'), join(output, 'claude-mcp.json')];
  for (const path of files) {
    try { await access(path); throw new Error(`The output file already exists: ${path}. Choose another folder.`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await writeFile(files[0], config.codexToml, { flag: 'wx', mode: 0o600 });
  await writeFile(files[1], config.claudeJson, { flag: 'wx', mode: 0o600 });
  return { files, included: config.included, nextStep: 'Review and merge the generated entries into your client settings. No AI-client settings were changed.' };
}
