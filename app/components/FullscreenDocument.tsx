import type {ReactNode} from 'react';
/** Setup, help, history and profile pages use normal document flow. */
export function FullscreenDocument({children}:{children:ReactNode}){return <div className="menu-document">{children}</div>;}
