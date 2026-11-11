import OnlinePhone from '../../../../components/online/OnlinePhone';
export const metadata={title:'Arcade Controller | King Prompter'};
export default async function Page({params}:{params:Promise<{code:string}>}){return <OnlinePhone code={(await params).code.toUpperCase()}/>}
