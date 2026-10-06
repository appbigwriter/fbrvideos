import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CodexOAuthInference } from '../src/codex-oauth.js';
test('Executável OAuth ausente retorna diagnóstico sanitizado, sem shell/login ou chamada de modelo',async()=>{
  const client=new CodexOAuthInference(join(tmpdir(),`fbr-missing-${randomUUID()}.exe`));
  await assert.rejects(client.run('Ensaio sintético sem dados privados.',{type:'object',properties:{},additionalProperties:false}),/oauth_cli_unavailable/);
});
