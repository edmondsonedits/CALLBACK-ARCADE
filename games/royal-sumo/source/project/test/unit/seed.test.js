import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSeed,deriveSeed,hashStr32,randomSeed,mix32} from '../../src/core/seed.js';

test('parseSeed accepts numbers, numeric strings, hex and words',()=>{
  assert.equal(parseSeed(1234),1234);
  assert.equal(parseSeed('1234'),1234);
  assert.equal(parseSeed(' 77 '),77);
  assert.equal(parseSeed('0xff'),255);
  assert.equal(parseSeed(0),0,'zero is a valid seed, not "no seed"');
  assert.equal(parseSeed('0'),0);
  assert.equal(parseSeed(-1),4294967295,'negative numbers wrap to uint32');
  assert.equal(parseSeed(4294967296+5),5);
  assert.equal(parseSeed(12.9),12);
  assert.equal(parseSeed('sunrise'),hashStr32('sunrise'));
  assert.notEqual(parseSeed('sunrise'),parseSeed('sunset'));
});
test('parseSeed treats absence as null',()=>{
  for(const v of [null,undefined,'','  ',NaN,Infinity,true,false])assert.equal(parseSeed(v),null,String(v));
});
test('deriveSeed is deterministic, uint32, order sensitive and never returns its input',()=>{
  const a=deriveSeed(1,2),b=deriveSeed(1,2);
  assert.equal(a,b);assert.ok(Number.isInteger(a)&&a>=0&&a<=4294967295);
  assert.notEqual(deriveSeed(1,2),deriveSeed(2,1));
  assert.notEqual(deriveSeed(1,2),deriveSeed(1,3));
  assert.notEqual(deriveSeed(5,0),5);
  assert.notEqual(deriveSeed(5,1,2),deriveSeed(5,2,1));
});
test('derived seeds are well spread (no collisions over a thousand matches)',()=>{
  const s=new Set();for(let i=0;i<1000;i++)s.add(deriveSeed(12345,i));
  assert.equal(s.size,1000);
});
test('randomSeed uses the injected source',()=>{
  assert.equal(randomSeed(()=>0),0);assert.equal(randomSeed(()=>0.5),2147483648);assert.ok(randomSeed(()=>0.999999999)<=4294967295);
});
test('mix32 is a bijection-like scrambler on small ints',()=>{
  const s=new Set();for(let i=0;i<5000;i++)s.add(mix32(i));assert.equal(s.size,5000);
});
