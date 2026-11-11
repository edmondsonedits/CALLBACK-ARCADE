/* CALLBACK standalone-game menu. Source-specific bridges own all gameplay. */
(()=>{'use strict';if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('online')==='1')return;function boot(){const game=window.CallbackArcadeGame;if(!game){requestAnimationFrame(boot);return}
const key='callback.arcade:'+game.id;let view='title',from='title',options={...game.defaults};
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved)for(const f of game.fields)if(Object.hasOwn(saved,f.id))options[f.id]=saved[f.id]}catch{/* Corrupt or unavailable storage falls back to game defaults. */}
const title=document.createElement('section');title.className='arcade-title-menu';title.setAttribute('aria-label',game.title+' starting menu');
title.innerHTML='<div class="arcade-title-card"><img class="arcade-title-emblem" src="/arcade-games/shared/assets/crown.svg" alt=""><p class="kicker">KING PROMPTER · ARCADE</p><h1></h1><p class="summary"></p><p class="arcade-menu-status"></p><div class="arcade-title-buttons"><button class="play">Play</button><div class="secondary"><button class="setup">Customize</button><button class="watch">Watch bots</button></div></div><a class="arcade-credits" href="/arcade-games/shared/credits.html" target="_blank" rel="noopener">Art credits</a></div>';
const onlineId={'royal-sumo':'sumo','royal-twisted':'twisted-system','royal-roller-ruckus':'roller-ruckus','royal-scratch-match':'scratch-match','royal-ballistix':'sky-balls'}[game.id]||game.id;const onlineLink=document.createElement('a');onlineLink.className='arcade-online-link';onlineLink.href='/arcade/online/new?game='+encodeURIComponent(onlineId);onlineLink.target='_top';onlineLink.textContent='Play online · up to 10 phones';title.querySelector('.arcade-title-buttons').append(onlineLink);
title.querySelector('h1').textContent=game.title;title.querySelector('.summary').textContent=game.summary;
const emblem={'snow-bash':'snowflake-1.svg','space-bash':'grenade.svg','drain-bash':'big-wave.svg','royal-ballistix':'big-wave.svg'}[game.id]||'crown.svg';title.querySelector('.arcade-title-emblem').src='/arcade-games/shared/assets/'+emblem;
const setup=document.createElement('dialog');setup.className='arcade-setup';setup.setAttribute('aria-label',game.title+' customization');
setup.innerHTML='<h2>Make it your match</h2><div class="arcade-setup-grid"></div><div class="arcade-map-detail"><strong></strong><p></p></div><p class="arcade-menu-status" role="status"></p><div class="arcade-setup-actions"><button class="reset">Reset defaults</button><button class="cancel">Back</button><button class="play">Play match</button></div>';
const inputs=new Map();for(const f of game.fields){const label=document.createElement('label');label.textContent=f.label;const input=document.createElement(f.choices?'select':'input');input.id='arcade-option-'+f.id;
 if(f.choices)for(const item of f.choices){const o=document.createElement('option');o.value=item.value;o.textContent=item.label;input.append(o)}else{input.type=f.type||'number';if(f.min!==undefined)input.min=f.min;if(f.max!==undefined)input.max=f.max;if(f.step!==undefined)input.step=f.step;if(input.type==='text')input.maxLength=20}
 label.htmlFor=input.id;label.append(input);setup.querySelector('.arcade-setup-grid').append(label);inputs.set(f.id,input);input.oninput=()=>{readOptions();mapDetail()}}
const menu=document.createElement('button');menu.className='arcade-menu-link';menu.textContent='Menu';menu.hidden=true;
const watch=document.createElement('div');watch.className='arcade-watch-tag';watch.textContent='BOTS PLAYING · WATCH & LEARN';watch.hidden=true;
const returnPause=document.createElement('dialog');returnPause.className='arcade-return-pause';returnPause.setAttribute('aria-label','Match paused');
returnPause.innerHTML='<h2>Ready when you are</h2><p>Your match paused while you were away.</p><button class="resume">Resume match</button>';
function resume(){returnPause.close();game.pause(false);menu.focus()}
returnPause.querySelector('.resume').onclick=resume;returnPause.addEventListener('cancel',e=>{e.preventDefault();resume()});
document.body.append(title,setup,menu,watch,returnPause);
function readOptions(){for(const f of game.fields){const el=inputs.get(f.id);let v=el.type==='checkbox'?el.checked:f.type==='text'||f.choices?el.value:Number(el.value);if(f.choices&&!f.choices.some(c=>String(c.value)===String(v)))v=game.defaults[f.id];if(typeof v==='number')v=Math.min(f.max??Infinity,Math.max(f.min??-Infinity,Number.isFinite(v)?v:game.defaults[f.id]));if(f.type==='text')v=Array.from(String(v)).filter(c=>c!=='<'&&c!=='>'&&c.charCodeAt(0)>=32&&c.charCodeAt(0)!==127).join('').slice(0,20);options[f.id]=v}return options}
function sync(){for(const f of game.fields){const el=inputs.get(f.id);if(el.type==='checkbox')el.checked=!!options[f.id];else el.value=options[f.id]}mapDetail()}
function mapDetail(){const map=game.arenas.find(m=>m.id===options.arena)||game.arenas[0];setup.querySelector('.arcade-map-detail strong').textContent=map.name;setup.querySelector('.arcade-map-detail p').textContent=map.skill;title.querySelector('.arcade-menu-status').textContent=map.name+' · '+options.players+' contestants'}
function persist(){try{localStorage.setItem(key,JSON.stringify(options))}catch{/* Private browsing can disable persistence; the match still works. */}}
function start(watching=false){readOptions();persist();setup.close();view=watching?'watch':'play';document.body.dataset.arcadeView=view;title.hidden=true;menu.hidden=false;watch.hidden=!watching;game.start({...options},watching);menu.focus()}
function settings(){from=view;game.pause(true);sync();setup.showModal();setup.querySelector('input,select,button')?.focus()}
function back(){setup.close();if(from==='title'){game.pause(false)}else{game.pause(false);menu.focus()}}
function showTitle(){readOptions();view='title';document.body.dataset.arcadeView=view;title.hidden=false;menu.hidden=true;watch.hidden=true;game.start({...options},true);title.querySelector('.play').focus()}
function restore(){if(document.hidden||setup.open||returnPause.open)return;if(view==='play'&&!document.querySelector('.arena-result')?.open){game.pause(true);returnPause.showModal();returnPause.querySelector('.resume').focus()}else game.pause(false)}
title.querySelector('.play').onclick=()=>start();title.querySelector('.watch').onclick=()=>start(true);title.querySelector('.setup').onclick=settings;
setup.querySelector('.play').onclick=()=>start();setup.querySelector('.cancel').onclick=back;setup.querySelector('.reset').onclick=()=>{options={...game.defaults};sync()};setup.addEventListener('cancel',e=>{e.preventDefault();back()});menu.onclick=()=>{game.pause(true);from=view;showTitle()};
window.CallbackGameMenu={settings,showTitle,start,restore,options:()=>({...options}),state:()=>({view,...game.state()})};
// Menu navigation must never trigger game controls behind a dialog.
window.addEventListener('keydown',e=>{if(setup.open||returnPause.open||view==='title')e.stopImmediatePropagation();else if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();settings()}},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)game.pause(true);else restore()});
let prev=0;function frame(t){if(t-prev>250){prev=t;if(!document.hidden&&!setup.open)game.menuTick?.(view);mapDetail()}requestAnimationFrame(frame)}
sync();showTitle();requestAnimationFrame(frame);}
boot();})();
