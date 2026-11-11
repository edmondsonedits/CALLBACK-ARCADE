import assert from 'node:assert/strict';
import test from 'node:test';
import {localOrigin,qaBindings,qaProcessEnv} from '../scripts/qa-config.mjs';

test('disposable QA rejects remote origins and removes inherited provider credentials',()=>{
  for(const value of ['https://callback.test','http://127.0.0.1.evil.test','http://name:secret@127.0.0.1:3000','http://127.0.0.1:3000/api'])assert.throws(()=>localOrigin(value));
  assert.throws(()=>qaBindings('http://127.0.0.1:8789','short'));
  const bindings=qaBindings('http://127.0.0.1:8789','a'.repeat(64));
  const env=qaProcessEnv({PATH:'local',OPENAI_API_KEY:'must-not-survive',CLOUDFLARE_AI_API_TOKEN:'must-not-survive',VITE_OPENAI_KEY:'must-not-survive',CALLBACK_QA_CONFIG_PATH:'foreign-config'},bindings);
  assert.equal(env.OPENAI_API_KEY,'');assert.equal(env.CLOUDFLARE_AI_API_TOKEN,'');assert.equal(env.OPENAI_IMAGES_ENABLED,'false');
  assert.equal(env.VITE_OPENAI_KEY,undefined);assert.equal(env.CALLBACK_QA_CONFIG_PATH,undefined);assert.equal(env.PATH,'local');
});
