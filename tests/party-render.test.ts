import test from 'node:test';import assert from 'node:assert/strict';
import { interpolatePartyFighters } from '../lib/party-render';
test('render positions interpolate and extrapolation is bounded during a network stall',()=>{
 const a=[{id:0,x:0,y:0,z:0,vx:10,vy:0,vz:0,alive:true}],b=[{...a[0],x:.5}];
 assert.equal(interpolatePartyFighters(a,b,.5,0)[0].x,.25);
 assert.ok(Math.abs(interpolatePartyFighters(a,b,1,1000)[0].x-.83)<1e-12);
 assert.equal(interpolatePartyFighters(a,[{...b[0],alive:false}],.5,0)[0].x,.5,'death cannot interpolate through arena boundaries');
});
