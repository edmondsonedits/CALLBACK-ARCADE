import OnlineHost from '../../../../components/online/OnlineHost';
export const metadata={title:'Callback Mirror Host'};
export default async function Page({params}:{params:Promise<{code:string}>}){return <OnlineHost code={(await params).code.toUpperCase()} readOnly/>;}
