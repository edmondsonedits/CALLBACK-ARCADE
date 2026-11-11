import {installArcadeTouchPolicy,installControlSizeToggle} from './touch-ui';
document.body.dataset.arcadeTouch='';installArcadeTouchPolicy(document);
// Imported games create menus after their own boot sequence.
if(new URLSearchParams(location.search).get('online')!=='1'){
 const button=document.createElement('button');installControlSizeToggle(button,document.body);
 const place=()=>{if(button.isConnected)return;const menu=['.cp-controller-header','.arcade-title-buttons','.su-scroll','#setupOverlay .setup-actions','#setupModal .modal-buttons','#setup .modalBtns','#menuOv .menu-actions','#menu .actions','#settingsDialog .dialogFoot','#modal .modalBtns','#settingsModal .modal-buttons'].map(selector=>document.querySelector<HTMLElement>(selector)).find(Boolean);if(menu)menu.appendChild(button);};
 const observer=new MutationObserver(place);observer.observe(document.body,{childList:true,subtree:true});place();
 window.addEventListener('pagehide',e=>{if(!e.persisted)observer.disconnect()});
}
