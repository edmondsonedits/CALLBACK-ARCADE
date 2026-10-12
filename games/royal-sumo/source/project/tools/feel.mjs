import {measureFeel} from '../test/support/feel.js';
const m=measureFeel();for(const [k,v] of Object.entries(m))console.log(k.padEnd(28),v);
