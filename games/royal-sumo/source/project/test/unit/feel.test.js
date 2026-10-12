// Game-feel budget: if a tuning change moves any of these out of its band, the game will FEEL different. Update the band on purpose.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureFeel} from '../support/feel.js';
const m=measureFeel();
const within=(name,v,lo,hi)=>test('feel: '+name+' '+v+' is within ['+lo+', '+hi+']',()=>assert.ok(v>=lo&&v<=hi,name+' = '+v));
within('time to 90% speed (s)',m.timeTo90Speed,.05,.25);
within('time to stop (s)',m.timeToStop,.3,.8);
within('stop distance (m)',m.stopDistance,.4,1.5);
within('time to reverse (s)',m.timeToReverse,.03,.3);
within('tap-bash start latency (s)',m.tapBashStartLatency,0,.05);
within('bash duration (s)',m.tapBashDuration,.2,.45);
within('charge to full (s)',m.chargeToFull,.5,1.0);
within('dash duration (s)',m.dashDuration,.2,.45);
within('dash distance (m)',m.dashDistance,1.2,3);
test('feel: a charged bash is released as a strike',()=>assert.equal(m.chargedBashActiveAfterRelease,true));
test('feel: a full-charge bash throws a rival at least 1.8x as far as a tap',()=>assert.ok(m.knockback_full>=1.8*m.knockback_light,JSON.stringify(m)));
test('feel: a full-charge bash hurts at least 2x as much as a tap',()=>assert.ok(m.stabLoss_full>=2*m.stabLoss_light,JSON.stringify(m)));
