import OnlineSetup from '../../../components/online/OnlineSetup';import {ONLINE_HOSTED_GAMES} from '../../../../lib/arcade/online/catalog';
export const metadata={title:'Phone Multiplayer | King Prompter'};
export default async function Page({searchParams}:{searchParams:Promise<{game?:string}>}){const query=await searchParams;return <OnlineSetup initialGame={ONLINE_HOSTED_GAMES.some(g=>g.id===query.game)?query.game!:'sumo'}/>}
