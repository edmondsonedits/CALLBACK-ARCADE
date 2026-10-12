// One place that knows how tests construct a Sim, so API changes only touch this file.
import {Sim} from '../../src/core/sim.js';
import {FIXED_DT} from '../../src/core/tune.js';
import {MAP_ORDER} from '../../src/core/maps.js';
export {Sim,FIXED_DT,MAP_ORDER};
/** spec: {map,n,seed,difficulty,hazard,humans:[ids],opts} -> Sim (not started). Seats not listed in `humans` are bots. */
export function makeSim(spec){
  return new Sim(Object.assign({},spec.opts||{},{map:spec.map,fighters:spec.n,difficulty:spec.difficulty||'normal',hazard:spec.hazard||'normal',seed:spec.seed,
    humans:(spec.humans&&spec.humans.length)?spec.humans:[-1]}));
}
