import {z} from 'zod';
const id=z.string().min(1).max(200);
const Ballot=z.object({id,actor:id,owner:id,round:z.number().int().min(1).max(3),options:z.array(id).length(3),optionTexts:z.array(z.string().max(2000)).length(3).optional(),issuedAt:z.number(),notBefore:z.number(),expiresAt:z.number(),choice:id.nullable().optional(),acceptedAt:z.number().optional(),reward:z.number().int().min(0).max(25)}).strict();
export const SorceryWorkshopSchema=z.object({
 leases:z.array(z.object({actor:id,until:z.number()})).max(10),
 closedRound:z.number().int().min(0).max(3),closeUntil:z.number().nullable(),
 intermissionRound:z.number().int().min(0).max(3),
 ballots:z.array(Ballot).max(60),
 nominations:z.array(z.object({actor:id,round:z.number().int().min(1).max(3),entry:id.nullable()})).max(30),
 reactions:z.array(z.object({actor:id,round:z.number().int().min(1).max(3),at:z.number(),kind:z.enum(['sparkles','applause','ink']),narrate:z.boolean().optional()})).max(60),
}).strict();
export type SorceryWorkshop=z.infer<typeof SorceryWorkshopSchema>;
export const emptyWorkshop=():SorceryWorkshop=>({leases:[],closedRound:0,closeUntil:null,intermissionRound:0,ballots:[],nominations:[],reactions:[]});
export const WorkshopActionSchema=z.object({actionId:z.string().uuid(),matchId:id,round:z.number().int().min(1).max(3),type:z.enum(['lease','leave','issue','choose','nominate','reaction']),ballotId:id.optional(),choice:id.nullable().optional(),reaction:z.enum(['sparkles','applause','ink']).optional()}).strict();
export type WorkshopAction=z.infer<typeof WorkshopActionSchema>;
export interface WorkshopSnapshot{
 available:boolean; editingAllowed:boolean;closeUntil:number|null;intermission:boolean;earned:number;
 ballot?:{id:string;options:Array<{id:string;text:string}>;notBefore:number;expiresAt:number};
 nominated:boolean;hallWinners:string[];
 reaction?:{kind:'sparkles'|'applause'|'ink';at:number;narrate?:boolean};
}
