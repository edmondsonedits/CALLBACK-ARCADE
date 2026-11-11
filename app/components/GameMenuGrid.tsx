import type {ReactNode} from 'react';
/** The entire catalog lives in one responsive menu. */
export function GameMenuGrid({children,className='session-games-grid'}:{children:ReactNode;className?:string}) {
  return <div className={`game-menu-grid ${className}`}>{children}</div>;
}
