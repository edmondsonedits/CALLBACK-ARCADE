import { SessionLobby } from '../../../components/SessionLobby';
export default async function SessionPlayerPage({params}:{params:Promise<{code:string}>}){return <SessionLobby code={(await params).code.toUpperCase()} mode="player"/>;}
