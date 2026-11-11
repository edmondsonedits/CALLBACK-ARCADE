export interface SumoInput { mx:number;mz:number;bashDown:boolean;bashPower:number;dash:boolean }
export interface SumoFighter {
  id:number;name:string;kind:string;style:number;input:SumoInput;x:number;z:number;y:number;
  alive:boolean;falling:boolean;bashSerial:number;dashSerial:number;charging:boolean;
  [key:string]:unknown;
}
export interface SumoSeat {owner:string;name:string;style:number;skill:string}
export interface SumoStats {kos:number;falls:number;hits:number;taken:number;dmg:number;best:number;rounds:number;[key:string]:number}
export interface SumoEvent {type:string;t:number;[key:string]:unknown}
export interface SumoRng {():number;state:number}
export class Sim {
  constructor(options?:Record<string,unknown>);
  seed:number;rng:SumoRng;map:SumoMap;O:Record<string,unknown>;n:number;
  inputs:SumoInput[];fighters:SumoFighter[];seats:SumoSeat[];humanSlots:Set<number>;
  arena:Record<string,unknown>|null;crowns:number[];stats:SumoStats[];events:SumoEvent[];
  phase:string;round:number;t:number;acc:number;phaseT:number;winTarget:number;winner:number;matchWinner:number;difficulty:string;
  startMatch():void;startRound():void;step(dt:number):void;advance(dt:number):void;drain():SumoEvent[];
  setOwner(id:number,owner:string):boolean;setOptions(o:Record<string,unknown>):void;
  endRound(winner:number):void;hudInfo():unknown;
  [key:string]:unknown;
}
export interface SumoMap {id:string;[key:string]:unknown}
export interface SumoCup {
  order:string[];stage:number;n:number;players:number;base:Record<string,unknown>;seed:number;
  total:number[];wins:number[];kos:number[];gain:number[];counted:number;
  history:{stage:number;map:string;winner:number;gain:number[]}[];
}
export interface SumoRank {id:number;rank:number;tied:boolean;crowns?:number;kos:number;points?:number;wins?:number;gain?:number}
export const MAPS:Record<string,SumoMap>;
export const MAP_ORDER:string[];
export const FIXED_DT:number;
export function mulberry32(seed:number):SumoRng;
export function normalizeOpts(options:Record<string,unknown>):Record<string,unknown>;
export function deriveSeed(seed:number,...indices:number[]):number;
export function cupOrder(start:string,all:string[]):string[];
export function newCup(options:{order:string[];n:number;players:number;base:Record<string,unknown>;seed:number}):SumoCup;
export function scoreStage(cup:SumoCup,result:{winner:number;stats:SumoStats[];n:number}):number[];
export function isFinalStage(cup:SumoCup):boolean;
export function standings(cup:SumoCup):SumoRank[];
export function champions(cup:SumoCup):number[];
export function rankMatch(result:{winner:number;n:number;crowns:number[];stats:SumoStats[]}):SumoRank[];
