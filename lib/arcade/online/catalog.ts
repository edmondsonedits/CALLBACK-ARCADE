import {PRACTICE_GAMES} from '../practice/catalog';import {FULL_ARCADE_GAMES} from './full-games';import {ARCADE_GAMES} from '../catalog';
import {isArchivedArcadeGame} from '../archived-games';
export const ONLINE_HOSTED_GAME_IDS=[...PRACTICE_GAMES.map(g=>g.id),'air-hockey','light-trails','tap-race'].filter(id=>!isArchivedArcadeGame(id));
export const ONLINE_HOSTED_GAMES=ONLINE_HOSTED_GAME_IDS.map(id=>({id,title:FULL_ARCADE_GAMES.find(g=>g.practiceId===id)?.title??PRACTICE_GAMES.find(g=>g.id===id)?.title??ARCADE_GAMES.find(g=>g.id===id)!.title}));
export function onlineLaunchHref(id:string):string|null{return ONLINE_HOSTED_GAME_IDS.includes(id as typeof ONLINE_HOSTED_GAME_IDS[number])?`/arcade/online/new?game=${id}`:null}
