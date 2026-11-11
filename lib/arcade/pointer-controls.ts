/** Each finger owns one control; releasing it never releases a different finger. */
export class PointerControls {
 private readonly owners=new Map<number,string>();
 claim(id:number,control:string,exclusive=false):boolean {
  if(this.owners.has(id)||exclusive&&this.held(control))return false;
  this.owners.set(id,control);return true;
 }
 owns(id:number,control:string):boolean{return this.owners.get(id)===control;}
 held(control:string):boolean{return [...this.owners.values()].includes(control);}
 release(id:number,control:string):boolean{if(!this.owns(id,control))return false;this.owners.delete(id);return true;}
 clear():void{this.owners.clear();}
}
