/* ============================================================================
   ROYAL SUMO - TUNING + MATCH OPTIONS  (constants shared by sim, AI, UI)
   ========================================================================== */
export const MAX_PLAYERS=10;
/** who drives a fighter: the AI, a person on this device, or an external controller (RoyalSumo.multiplayer) */
export const OWNERS=Object.freeze(['bot','local','remote']);
export const FIXED_DT=1/120;
export const LAVA_Y=-7;
export const NAMES=['YOU','RUFUS','MABEL','GREGOR','TILLY','BARNABY','NELL','OSWALD','BEA','PIP'];
export const PERSONALITIES=['player','aggressive','cautious','opportunist','aggressive','cautious','opportunist','cautious','aggressive','opportunist'];

export const TUNE={
  radius:.60, maxSpeed:3.75, accel:34, coast:4.3, stagDrag:2.0, turn:15,
  chargeTime:.85, minPower:.18, chargeMove:.60, deadzone:.075, expo:1.35, floor:.16,
  bash:{dur:.30,durP:.06,hitStart:.04,hitEnd:.20,lunge:3.0,lungeP:4.2,reach:.62,reachP:.38,arcDot:.55,
        force:4.0,forceP:5.6,dmg:7,dmgP:18,cd:.26,cdP:.60,whiff:.30,whiffP:.30,hitRec:.12,steer:.18,brake:.70},
  dash:{dur:.30,speed:8.4,drag:3.0,cd:2.4,force:6.6,dmg:15,recoil:.40,rec:.30,whiff:.26,steer:.22,reach:.14},
  contact:{rest:.32,slop:.012,corr:.85,bump:2.0,bumpStab:.30,hard:3.4,hardStag:.10,downMass:1.7,fric:5.0},
  stab:{regen:6.0,delay:2.0,vulnMin:.45,vulnRange:1.20,getup:55,protect:1.0,protectScale:.45},
  down:{impact:.18,limp:.68,brace:.24,rise:.34},
  edge:{pad:.18,delay:.10,teeter:.45},
  fall:{g:22,hop:1.6},
  round:{intro:1.15,count:2.1,end:2.6},
  arena:{r0base:5.0,r0per:.30,core0:2.0,corePer:.07,tile:1.2,warnLead:2.3,sweep:.9,
         first0:9.5,firstPer:1.0,int0:7.0,intPer:.25,sudden:9.0,coreMin:.58}
};

/* Bot skill ladder. think/react are seconds-multipliers (lower = sharper); the rest are 0..1-ish odds. */
export const DIFF={
  rookie:{think:1.75,react:1.15,dodge:.02,aim:.36,dashRate:0,  aggr:.62,power:.60,punish:.07,mistake:.45},
  easy:  {think:1.35,react:.80, dodge:.10,aim:.24,dashRate:.04,aggr:.80,power:.75,punish:.22,mistake:.30},
  normal:{think:1.00,react:.45, dodge:.32,aim:.12,dashRate:.10,aggr:1.00,power:1.00,punish:.50,mistake:.16},
  hard:  {think:.78, react:.28, dodge:.58,aim:.06,dashRate:.17,aggr:1.12,power:1.15,punish:.80,mistake:.07},
  legend:{think:.60, react:.16, dodge:.80,aim:.03,dashRate:.24,aggr:1.22,power:1.20,punish:.95,mistake:.02}
};
const DIFF_ORDER=['rookie','easy','normal','hard','legend'];
export const DIFF_LABEL={rookie:'Page',easy:'Squire',normal:'Knight',hard:'Champion',legend:'Legend',mixed:'Mixed'};
export const MIXED_LADDER=['normal','hard','easy','normal','legend','easy','hard','normal','easy','hard'];

/* Match options (everything the player can tune for a match). Hazard/length/dash are named levels. */
export const HAZARD_LEVELS={off:0,mild:.7,normal:1,wild:1.45};
export const LENGTH_SECS={short:26,normal:0,long:64,epic:95};      // 0 = the map's own pacing
export const DASH_CD={off:0,fast:.55,normal:1,slow:1.7};
export const NULL_INPUT=Object.freeze({mx:0,mz:0,bashDown:false,bashPower:-1,dash:false});
