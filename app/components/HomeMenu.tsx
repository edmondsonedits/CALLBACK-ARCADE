"use client";
import {type Dispatch,type SetStateAction} from 'react';
import Link from 'next/link';
import {SessionRoleChoice} from './SessionRoleChoice';
import {WinnersShowcase} from './WinnersShowcase';
import {MenuSettingsDialog,type MenuPreferences} from './MenuSettingsDialog';
import { HouseEdmondson } from './HouseEdmondson';
import { useHistoryPanel } from './useHistoryPanel';

export function HomeMenu({reducedMotion,preferences,onPreferencesChange,onReplayIntro}:{reducedMotion:boolean;preferences:MenuPreferences;onPreferencesChange:Dispatch<SetStateAction<MenuPreferences>>;onReplayIntro:()=>void}){
 const [screen,setScreen]=useHistoryPanel<'home'|'art'>('home');
 const [settingsOpen,setSettingsOpen]=useHistoryPanel(false);
 return <div className="home-menu-screens">
  <div className="home-primary-menu" hidden={screen!=='home'} inert={screen!=='home'}><SessionRoleChoice/><nav className="home-secondary-links" aria-label="Explore King Prompter"><Link href="/avatar-studio">Your character</Link><Link href="/history-books">History Books</Link><Link href="/how-to-play">How to play</Link><button type="button" onClick={()=>setSettingsOpen(true)}>Settings</button><button type="button" onClick={()=>setScreen('art')}>Winning artwork</button><Link href="/party-games">Browse games</Link><Link href="/arcade">Arcade games</Link><HouseEdmondson/></nav></div><section className="home-submenu" hidden={screen!=='art'} inert={screen!=='art'}>
   <header><button type="button" className="button button-secondary" onClick={()=>setScreen('home')}>Back</button><h1>Winning artwork</h1></header>
   <div className="home-art-screen"><WinnersShowcase reducedMotion={reducedMotion} blocked={screen!=='art'||settingsOpen}/></div>
  </section>
  <MenuSettingsDialog open={settingsOpen} preferences={preferences} replayDisabled={reducedMotion} onChange={onPreferencesChange} onClose={()=>setSettingsOpen(false)} onReplayIntro={()=>{setSettingsOpen(false);onReplayIntro();}}/>
 </div>;
}
