"use client";
import { createContext,useContext,useEffect, type ReactNode } from 'react';
import { AvatarPuppetPad } from './AvatarPuppetPad';
import { PhoneTaskPages } from './PhoneTaskPages';
import { ScrollPanel } from './ScrollPanel';
import type { AvatarConfig } from '../../lib/avatar-runtime';
import { useHistoryPanel } from './useHistoryPanel';
type Section='game'|'character'|'style';
const Navigation=createContext<(section:Section)=>void>(()=>{});
export const usePhoneNavigation=()=>useContext(Navigation);

/** Keep the game mounted so switching screens never discards a private draft. */
export function PhoneSections({children, character, style, taskKey}: {children:ReactNode;character?:{playerId:string;index:number;color:string;config?:AvatarConfig|null;label:string};style?:ReactNode;taskKey?:string}) {
  const [requestedSection,setSection,,discardSectionBranch]=useHistoryPanel<Section>('game');
  const section=requestedSection==='style'&&!style?'game':requestedSection;
  useEffect(()=>{if(!style&&requestedSection==='style')discardSectionBranch();},[requestedSection,discardSectionBranch,style]);
  return <Navigation.Provider value={setSection}><div className="phone-sections">
    <div className="phone-section-screen phone-game-screen" hidden={section!=='game'} inert={section!=='game'}><PhoneTaskPages active={section==='game'} taskKey={taskKey}>{children}</PhoneTaskPages></div>
    {character&&<div className="phone-section-screen" hidden={section!=='character'} inert={section!=='character'}><AvatarPuppetPad {...character} expanded active={section==='character'}/></div>}
    {style&&<div className="phone-section-screen phone-style-screen" hidden={section!=='style'} inert={section!=='style'}><div className="phone-section-heading"><button type="button" onClick={()=>setSection('game')}>Back</button><strong>Your look</strong></div><ScrollPanel active={section==='style'}>{style}</ScrollPanel></div>}
    <nav className="phone-section-nav" aria-label="Phone sections">
      <button type="button" aria-pressed={section==='game'} onClick={()=>setSection('game')}>Game</button>
      {character&&<button type="button" aria-pressed={section==='character'} onClick={()=>setSection('character')}>Character</button>}
      {style&&<button type="button" aria-pressed={section==='style'} onClick={()=>setSection('style')}>Style</button>}
    </nav>
  </div></Navigation.Provider>;
}
