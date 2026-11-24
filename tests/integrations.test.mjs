import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { integrationStatus, createClientConfig, exportClientConfig } from '../server/integrations.mjs';
async function fixture(t) { const root=await mkdtemp(join(tmpdir(),'tawdheef-native-config-')); t.after(()=>rm(root,{recursive:true,force:true,maxRetries:5})); const dataDir=join(root,'private data'); await mkdir(dataDir); return {root,dataDir,port:4018}; }
test('client config contains only the tracker and explicitly selected direct Tabbio',async t=>{
  const options=await fixture(t), baseline=await createClientConfig(options);
  assert.deepEqual(baseline.included,['apply-tracker']); assert.equal(baseline.mcpServers['apply-tracker'].env.APPLY_TRACKER_DATA,options.dataDir);
  assert.equal(JSON.parse(baseline.claudeJson).mcpServers['apply-tracker'].type,'stdio');
  for(const include of [['playwright'],['outlook-mcp'],['google-cli']]) await assert.rejects(createClientConfig({...options,include}),/actual client/);
  await assert.rejects(createClientConfig({...options,mode:'local-adapters'}),/retired/);
  const direct=await createClientConfig({...options,include:['tabbio']}); assert.equal(direct.mcpServers.tabbio.url,'https://server.tabbio.com/api/mcp');
  const output=join(options.root,'exported'), result=await exportClientConfig(output,options), original=await readFile(result.files[0],'utf8');
  await assert.rejects(exportClientConfig(output,options),/already exists/); assert.equal(await readFile(result.files[0],'utf8'),original);
});
test('readiness ignores and preserves historical private provider credentials',async t=>{
  const options=await fixture(t), path=join(options.dataDir,'connections.private.json'), privateBytes='{"email":{"auth":{"refreshToken":"fixture-secret"}}}'; await writeFile(path,privateBytes);
  const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/api/health'?{ok:true,app:'apply-tracker'}:{mcpServers:{'apply-tracker':{env:{APPLY_TRACKER_DATA:join(options.root,'someone-else')}}}}));});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok)); t.after(()=>new Promise(ok=>server.close(ok)));
  const status=await integrationStatus({...options,mode:'local-adapters',port:server.address().port});
  assert.equal(status.mode,'native'); assert.equal(status.app.running,true); assert.equal(status.app.sameDataDirectory,false); assert.deepEqual(status.integrations,[]); assert.equal(status.accountConnected,false);
  assert.ok(!JSON.stringify(status).includes('fixture-secret')); assert.equal(await readFile(path,'utf8'),privateBytes);
});
test('the Tabbio MCP URL defaults to the published endpoint and can point a developer setup at another environment', async t => {
  const { tabbioMcpUrl, TABBIO_MCP_URL } = await import('../server/integrations.mjs');
  assert.equal(tabbioMcpUrl({}), TABBIO_MCP_URL);
  assert.equal(tabbioMcpUrl({ TAWDHEEF_TABBIO_MCP_URL: ' ' }), 'https://server.tabbio.com/api/mcp');
  assert.equal(tabbioMcpUrl({ TAWDHEEF_TABBIO_MCP_URL: 'https://api.tabbio.dev/api/mcp/' }), 'https://api.tabbio.dev/api/mcp');
  assert.equal(tabbioMcpUrl({ TAWDHEEF_TABBIO_MCP_URL: 'https://api.tabbio.dev/api/mcp/start' }), 'https://api.tabbio.dev/api/mcp/start');
  assert.equal(tabbioMcpUrl({ TAWDHEEF_TABBIO_MCP_URL: 'http://127.0.0.1:3001/api/mcp' }), 'http://127.0.0.1:3001/api/mcp');
  for (const bad of ['http://evil.example/api/mcp', 'https://api.tabbio.dev/other', 'https://u:p@api.tabbio.dev/api/mcp', 'https://api.tabbio.dev/api/mcp?x=1', 'not a url']) {
    assert.throws(() => tabbioMcpUrl({ TAWDHEEF_TABBIO_MCP_URL: bad }), /TAWDHEEF_TABBIO_MCP_URL/, bad);
  }
  const previous = process.env.TAWDHEEF_TABBIO_MCP_URL;
  process.env.TAWDHEEF_TABBIO_MCP_URL = 'https://api.tabbio.dev/api/mcp';
  t.after(() => { if (previous === undefined) delete process.env.TAWDHEEF_TABBIO_MCP_URL; else process.env.TAWDHEEF_TABBIO_MCP_URL = previous; });
  const options = await fixture(t);
  const config = await createClientConfig({ ...options, include: ['tabbio'], assistant: 'claude-code' });
  assert.deepEqual(config.mcpServers.tabbio, { type: 'http', url: 'https://api.tabbio.dev/api/mcp' });
  assert.match(config.codexToml, /url = "https:\/\/api\.tabbio\.dev\/api\/mcp"/);
});
