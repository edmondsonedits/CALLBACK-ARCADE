import assert from 'node:assert/strict';
import test from 'node:test';
import {createSumoParty,controlSumoParty,stepSumoParty,acceptPartyInput,setPartySeatConnection,projectSumoBootstrap} from '../lib/party/sumo-runtime';
import {validatePartyMessage} from '../lib/party/protocol';

test('real-time Sumo supports disabled bots and sparse human seats without renumbering identity',()=>{
 const party=createSumoParty({partyId:'party',roomCode:'ABCD',matchId:'match',now:0,roster:[{id:'00',name:'One',memberId:'one'},{id:'08',name:'Nine',memberId:'nine'}]});
 for(let i=1;i<10;i++)if(i!==8){const result=controlSumoParty(party,'host',{operation:'bot',epoch:0,seq:i,seatId:String(i).padStart(2,'0'),enabled:false},0);assert.equal(result.ok,true);}
 assert.equal(controlSumoParty(party,'host',{operation:'start',epoch:0,seq:11},0).ok,true);
 stepSumoParty(party,3000);assert.equal(party.liveSimulation!.n,2);
 assert.deepEqual(projectSumoBootstrap(party).view.seatIds,['00','08']);
 setPartySeatConnection(party,'nine',true,3000,'socket');
 assert.equal(acceptPartyInput(party,'nine',{type:'input',v:1,epoch:party.epoch,seq:1,x:1,y:0,bashDown:false,dash:false},3001),true);
 stepSumoParty(party,3017);assert.equal(party.liveSimulation!.inputs[1].mx,1);
 assert.equal(controlSumoParty(party,'host',{operation:'bot',epoch:party.epoch,seq:12,seatId:'01',enabled:true},3018).ok,false);
});
test('real-time Sumo requires two eligible contestants and bot changes are host-only',()=>{
 const p=createSumoParty({partyId:'party',roomCode:'ABCD',matchId:'match',now:0,roster:[{id:'00',name:'One',memberId:'one'}]});
 assert.throws(()=>validatePartyMessage(JSON.stringify({type:'control',v:1,epoch:0,seq:1,operation:'bot',seatId:'01',enabled:false}),'player'));
 for(let i=1;i<10;i++)controlSumoParty(p,'host',{operation:'bot',epoch:0,seq:i,seatId:String(i).padStart(2,'0'),enabled:false},0);
 assert.equal(controlSumoParty(p,'host',{operation:'start',epoch:0,seq:11},0).ok,false);
 assert.equal(controlSumoParty(p,'host',{operation:'bot',epoch:0,seq:12,seatId:'00',enabled:false},0).ok,false);
});
