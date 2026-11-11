import assert from "node:assert/strict";
import test from "node:test";
import {sampleFishFragments} from "../lib/fish-particles";

test("fish paint fragments are deterministic and use bounded original-image tiles",()=>{
 const fragments=sampleFishFragments("bite-one",180);assert.equal(fragments.length,36);
 assert.deepEqual(fragments,sampleFishFragments("bite-one",180));assert.notDeepEqual(fragments,sampleFishFragments("bite-two",180));
 for(const p of fragments){assert.ok(p.u>=0&&p.v>=0&&p.u+p.width<=1.000001&&p.v+p.height<=1.000001);for(const value of Object.values(p))assert.ok(Number.isFinite(value));}
});
test("fragments scatter after the bite then dissipate completely without accumulated state",()=>{
 assert.deepEqual(sampleFishFragments("bite",-1),[]);assert.deepEqual(sampleFishFragments("bite",NaN),[]);
 const first=sampleFishFragments("bite",100),later=sampleFishFragments("bite",800);
 assert.ok(first.some((p,i)=>Math.hypot(p.x-later[i]!.x,p.y-later[i]!.y)>.2));
 assert.ok(later.every((p,i)=>p.opacity<first[i]!.opacity&&p.scale<first[i]!.scale));
 assert.deepEqual(sampleFishFragments("bite",1200),[]);assert.deepEqual(sampleFishFragments("bite",1e8),[]);
 for(let age=0;age<1200;age+=17)for(const p of sampleFishFragments("bite",age)){assert.ok(p.opacity>=0&&p.opacity<=1);assert.ok(Math.abs(p.x)<2&&Math.abs(p.y)<2);}
 assert.deepEqual(sampleFishFragments("bite",100),first,"seek and pause never integrate particle positions");
});
