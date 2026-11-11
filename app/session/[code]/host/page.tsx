import { SessionLobby } from '../../../components/SessionLobby';
export default async function SessionHostPage({params}:{params:Promise<{code:string}>}){return <SessionLobby code={(await params).code.toUpperCase()} mode="host"/>;}
