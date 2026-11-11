/* Same-origin renderer-only bridge. The server owns every match decision. */
(()=>{'use strict';if(new URLSearchParams(location.search).get('online')!=='1')return;let pending=null,ready=false;
function apply(){if(!window.CallbackOnlineView?.apply)return false;if(!ready){ready=true;parent.postMessage({type:'callback:online-ready'},location.origin)}if(pending){window.CallbackOnlineView.apply(pending);pending=null;}return true;}
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='callback:online-view')return;const s=e.data.snapshot;if(!s||typeof s!=='object'||typeof s.matchId!=='string'||!Number.isSafeInteger(s.version))return;pending=s;apply();});
function boot(){if(!apply())requestAnimationFrame(boot)}requestAnimationFrame(boot);
})();
