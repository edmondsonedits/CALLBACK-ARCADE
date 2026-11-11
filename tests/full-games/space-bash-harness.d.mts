interface Fighter {id:number;x:number;z:number;y:number;hp:number;alive:boolean;falling:boolean;think:number;control:string;name:string;[key:string]:unknown}
interface Bridge { defaults:Record<string,unknown>;start(o:Record<string,unknown>,watch:boolean):void;pause(on:boolean):void;state():Record<string,unknown> }
interface TestGame { fighters:Fighter[];phase:string;paused:boolean;crates:unknown[];tiles:{alive:boolean}[];joy:{x:number;z:number;active:boolean};step(dt:number):void;advance(s:number):void;jump(f:Fighter):void;sandbox:{CallbackArcadeGame:Bridge};[key:string]:unknown }
export function game(seed?:number):TestGame;
