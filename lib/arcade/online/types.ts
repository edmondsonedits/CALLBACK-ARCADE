export interface OnlineInput {
 seq:number; x:number; y:number; action?:string; lane?:number;
 bashDown?:boolean; bashPower?:number; dash?:boolean;
 laneMask?:number;heldActions?:string[];
}
export interface OnlineControl {action:string;label:string;key?:string;hold?:boolean;lane?:number}
export interface OnlineView {
 view:unknown;finished:boolean;winners:string[];scores:Record<string,number>;
}
/** State must survive JSON round trips; one step advances 1/30 second. */
export interface OnlineEngine {
 id:string;title:string;controls:readonly OnlineControl[];
 create(ids:string[],seed:number,options:Record<string,unknown>,botIds:string[]):unknown;
 step(state:unknown,inputs:Record<string,OnlineInput>,botIds:string[]):unknown;
 publicState(state:unknown):OnlineView;
}
