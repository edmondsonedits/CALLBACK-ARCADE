import OnlineHost from '../../../../components/online/OnlineHost';
export const metadata={title:'Arcade Host | King Prompter'};
export default async function Page({params}:{params:Promise<{code:string}>}){return <OnlineHost code={(await params).code.toUpperCase()}/>}
