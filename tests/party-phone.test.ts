import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {controlComponent,nodes,pointer,touchTarget,type Node} from './helpers/control-component';
type Input={x:number;y:number;bashDown:boolean;dash:boolean};
function setup(){
 const sent:Input[]=[];
 const component=controlComponent(fileURLToPath(new URL('../app/components/online/RealtimeSumoPhone.tsx',import.meta.url)),{'./usePartySocket':{usePartySocket:()=>({connected:true,status:{phase:'PLAYING',simPhase:'fight',epoch:1,round:1,alive:[true]},sendInput:(v:Input)=>{sent.push({...v});return true}})}});
 Object.assign(component.window,{setInterval:()=>1,clearInterval(){}});
 const tree=component.render({room:{code:'ABCD',selfId:'00',players:[{id:'00',name:'Pilot'}]}});
 const button=(label:string)=>nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||n.props.className===label))!;
 const call=(n:Node,event:string,value:unknown)=>(n.props[event] as (e:unknown)=>void)(value);
 return {component,sent,button,call};
}
test('Sumo second-finger charge release keeps the first-finger movement and hold sources stay independent',()=>{
 const {component,sent,button,call}=setup(),stick=button('Move fighter'),charge=button('sumo-live-charge'),stickTarget=touchTarget(),chargeTarget=touchTarget();
 call(stick,'onPointerDown',pointer(1,stickTarget));call(charge,'onPointerDown',pointer(2,chargeTarget));call(charge,'onPointerDown',pointer(3,chargeTarget));
 call(charge,'onPointerUp',pointer(2,chargeTarget));assert.equal(sent.at(-1)!.bashDown,true);assert.ok(sent.at(-1)!.x>.5);
 call(charge,'onPointerUp',pointer(3,chargeTarget));assert.equal(sent.at(-1)!.bashDown,false);assert.ok(sent.at(-1)!.x>.5);
 call(stick,'onPointerUp',pointer(99,stickTarget));assert.ok(sent.at(-1)!.x>.5);
 call(stick,'onPointerUp',pointer(1,stickTarget));assert.equal(sent.at(-1)!.x,0);component.dispose();
});
test('Sumo pointer dash fires once while native keyboard activation also works',()=>{
 const {component,sent,button,call}=setup(),dash=button('sumo-live-dash');
 call(dash,'onPointerDown',pointer(1));call(dash,'onClick',{detail:1});assert.equal(sent.filter(v=>v.dash).length,1);
 call(dash,'onClick',{detail:0});assert.equal(sent.filter(v=>v.dash).length,2);component.dispose();
});
