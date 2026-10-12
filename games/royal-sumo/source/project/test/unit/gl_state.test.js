// GL state hygiene on a mock WebGL2 that models what real drivers do with VAOs: the ELEMENT_ARRAY_BUFFER binding lives inside the bound VAO,
// and deleting a buffer unbinds it from every VAO. Regression for "GL_INVALID_OPERATION: Must have element array buffer bound" (all particles
// vanished after a few rounds because building a new scene re-pointed the last-drawn FX batch's VAO at a mesh that was deleted later).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MB,Batch} from '../../src/gfx/engine.js';

function mockGL(){
  const errors=[],vaos=new Set(),defaultVao={ebo:null};let cur=null,id=1;
  const gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,DYNAMIC_DRAW:4,FLOAT:5,TRIANGLES:6,UNSIGNED_INT:7,errors,
    createBuffer(){return {id:id++,deleted:false}},
    deleteBuffer(b){b.deleted=true;for(const v of vaos)if(v.ebo===b)v.ebo=null;if(defaultVao.ebo===b)defaultVao.ebo=null},
    bindBuffer(t,b){if(t===gl.ELEMENT_ARRAY_BUFFER)(cur||defaultVao).ebo=b},
    bufferData(){},bufferSubData(){},
    createVertexArray(){const v={ebo:null};vaos.add(v);return v},bindVertexArray(v){cur=v},deleteVertexArray(v){vaos.delete(v)},
    enableVertexAttribArray(){},vertexAttribPointer(){},vertexAttribDivisor(){},
    drawElementsInstanced(){if(!cur||!cur.ebo||cur.ebo.deleted)errors.push('no element array buffer bound')}};
  return gl;
}
const quad=gl=>{const m=new MB();m.v(-.5,-.5,0,0,0,1,0,0,1,1,1);m.v(.5,-.5,0,0,0,1,1,0,1,1,1);m.v(.5,.5,0,0,0,1,1,1,1,1,1);m.v(-.5,.5,0,0,0,1,0,1,1,1,1);m.quad(0,1,2,3);return m.build(gl)};

test('mock sanity: a batch draws cleanly, and a deleted index buffer is detected',()=>{
  const gl=mockGL(),q=quad(gl),b=new Batch(gl,q,4);b.add(0,0,0,0,0,0,1,1,1,1,1,1);b.draw();
  assert.deepEqual(gl.errors,[]);
  q.dispose();b.draw();assert.equal(gl.errors.length,1);
});
test('building and disposing meshes after a draw never breaks the batch that drew last',()=>{
  const gl=mockGL(),fxMesh=quad(gl),fx=new Batch(gl,fxMesh,8);fx.add(0,0,0,0,0,0,1,1,1,1,1,1);
  for(let round=0;round<8;round++){
    fx.draw();                                         // the FX batch is the last thing drawn each frame, so its VAO stays bound
    const sceneMesh=quad(gl);                          // next round: a new scene builds its own meshes ...
    const sceneBatch=new Batch(gl,sceneMesh,2);sceneBatch.add(0,0,0,0,0,0,1,1,1,1,1,1);sceneBatch.draw();
    sceneBatch.dispose();sceneMesh.dispose();          // ... and the old one is disposed
    fx.draw();
  }
  assert.deepEqual(gl.errors,[],'FX batch lost its index buffer');
});
test('a mesh built while a VAO is bound leaves that VAO untouched',()=>{
  const gl=mockGL(),a=quad(gl),batch=new Batch(gl,a,2);batch.add(0,0,0,0,0,0,1,1,1,1,1,1);batch.draw();
  const before=gl.createVertexArray;               // (the batch VAO is bound now)
  const m=quad(gl);m.dispose();batch.draw();
  assert.deepEqual(gl.errors,[]);assert.ok(before);
});
