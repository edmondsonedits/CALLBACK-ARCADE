// Golden-hash regression: same seed + same inputs must always play out identically for a given VERSIONS.sim.
//   changed behaviour on purpose?  ->  bump VERSIONS.sim in src/core/versions.js, then:  node test/unit/golden.test.js --update
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runScenario,goldenMatrix} from '../support/scenario.js';
import {makeSim,FIXED_DT,MAP_ORDER} from '../support/adapters.js';
import {VERSIONS} from '../../src/core/versions.js';
const FILE=new URL('../golden/sim.json',import.meta.url);
const matrix=goldenMatrix(MAP_ORDER);
function compute(){const rows={};for(const spec of matrix){const r=runScenario(makeSim,FIXED_DT,spec);rows[spec.id]={digest:r.digest,events:r.events,round:r.round,phase:r.phase,crowns:r.crowns,matchWinner:r.matchWinner}}return rows}
if(process.argv.includes('--update')){
  const rows=compute();
  fs.writeFileSync(FILE,JSON.stringify({simVersion:VERSIONS.sim,node:process.version,v8:process.versions.v8,rows},null,1)+'\n');
  console.log('golden updated for sim '+VERSIONS.sim+' ('+Object.keys(rows).length+' scenarios)');
}else{
  const golden=JSON.parse(fs.readFileSync(FILE,'utf8'));
  test('golden file belongs to the current VERSIONS.sim',()=>{
    assert.equal(golden.simVersion,VERSIONS.sim,'VERSIONS.sim is '+VERSIONS.sim+' but test/golden/sim.json was recorded for '+golden.simVersion+'. Run: node test/unit/golden.test.js --update');
  });
  const rows=compute();
  for(const spec of matrix){
    test('golden '+spec.id,()=>{
      const want=golden.rows[spec.id],got=rows[spec.id];
      assert.ok(want,'no golden row for '+spec.id);
      const hint=golden.v8===process.versions.v8?'':' (golden recorded on V8 '+golden.v8+', running on '+process.versions.v8+': tiny float differences possible)';
      assert.equal(got.digest,want.digest,'Simulation behaviour changed for '+spec.id+' while VERSIONS.sim is still '+VERSIONS.sim+'. If intentional: bump VERSIONS.sim and run node test/unit/golden.test.js --update'+hint);
      assert.deepEqual({events:got.events,round:got.round,phase:got.phase,crowns:got.crowns,matchWinner:got.matchWinner},{events:want.events,round:want.round,phase:want.phase,crowns:want.crowns,matchWinner:want.matchWinner});
    });
  }
}
