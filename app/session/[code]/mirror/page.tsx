import {SessionLobby} from '../../../components/SessionLobby';
export default async function Page({params}:{params:Promise<{code:string}>}){return <SessionLobby code={(await params).code.toUpperCase()} mode="mirror"/>;}
