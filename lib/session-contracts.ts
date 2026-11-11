import { z } from 'zod';
import { isArchivedGamePack } from './game/archived-packs';
import { isArchivedArcadeGame } from './arcade/archived-games';
import { AvatarConfigSchema, AvatarPresetSchema, ContentModeSchema, GameLengthSchema } from './contracts';
import { ArcadeGameIdSchema } from './arcade/contracts';
import type { AvatarConfig } from './avatar-runtime';

export const SessionGameSchema = z.object({ realtimePilot:z.boolean().optional(),sumoPilotOptions:z.object({map:z.enum(['keep','floe','plaza','wharf','teeter','mesa']),mode:z.enum(['quick','cup']),winTarget:z.number().int().min(1).max(7)}).strict().optional(), kind: z.enum(['main','online']), gameId: z.string().min(1).max(50), arcadeGameId: ArcadeGameIdSchema.optional(), contentMode: ContentModeSchema.default('party'), timerAccessibility: z.boolean().default(false), sorceryLength:z.enum(['quick','long']).optional(), birthdayName: z.string().trim().min(1).max(40).optional() }).strict().superRefine((v,c) => { if(v.realtimePilot && (v.kind!=='online'||v.gameId!=='sumo'))c.addIssue({code:'custom',message:'The real-time pilot supports Royal Sumo only.'}); if (v.kind==='main' && !GameLengthSchema.safeParse(v.gameId).success) c.addIssue({code:'custom',message:'Choose a supported game.'}); if(v.kind==='main'&&isArchivedGamePack(v.gameId)) c.addIssue({code:'custom',message:'This game pack is archived and unavailable for new rooms.'}); if(v.kind==='online'&&isArchivedArcadeGame(v.gameId)) c.addIssue({code:'custom',message:'This Arcade game is archived and unavailable for new rooms.'}); if(v.kind==='main'&&v.gameId==='arcade'&&(!v.arcadeGameId||isArchivedArcadeGame(v.arcadeGameId))) c.addIssue({code:'custom',message:'Choose an available Arcade game.'}); if(v.kind==='main'&&v.gameId==='birthday'&&!v.birthdayName)c.addIssue({code:'custom',message:'Enter the birthday name.'}); });
export type SessionGame = z.infer<typeof SessionGameSchema>;
export const SessionJoinSchema = z.object({ nickname:z.string().trim().min(1).max(20), avatarConfig:AvatarConfigSchema.optional(), avatarPreset:AvatarPresetSchema.nullable().optional() }).strict();
export type SessionPlayer = {id:string;seat:number;nickname:string;avatarConfig?:AvatarConfig;avatarPreset:string|null;connected:boolean};
export type SessionActiveGame = {id:string;kind:'main'|'online';code:string;title:string;hostPath:string;playPath:string};
export const SessionPresentationSchema = z.object({category:z.enum(['party','arcade']).nullable(),extended:z.boolean(),birthdayName:z.string().max(40)}).strict();
export type SessionPresentation = z.infer<typeof SessionPresentationSchema>;
export type SessionRole = 'host'|'player'|'mirror';
export type SessionView = {code:string;version:number;stage:'SELECTING'|'PREPARING'|'PLAYING'|'CLOSED';role:SessionRole;selfId:string|null;players:SessionPlayer[];activeGame:SessionActiveGame|null;frameUrl:string|null;presentation:SessionPresentation;mirrorCode?:string};
