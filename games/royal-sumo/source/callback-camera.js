(()=>{
/* CALLBACK shared camera controls */
const callbackCameraState={rotate:0,zoom:1,tilt:0};
function callbackCameraClamp(v,a,b){return Math.max(a,Math.min(b,v))}
// Camera preferences are applied around the renderer call and restored afterwards.
// The imported simulation, input routing and source modules remain unchanged.
function callbackCameraAdapter(){}
function installRendererAdapter(){
  const renderer=window.RoyalSumo.debug.renderer();
  const update=renderer.updateCamera;
  renderer.updateCamera=function(dt,sim,focus){
    const c=this.cam, yaw=c.yaw, zoom=c.zoomPref, pitch=c.pitchPref;
    const basePitch=(this.aspect||1)<.85?.95:.86;
    c.yaw=yaw+callbackCameraState.rotate*Math.PI/180;
    c.zoomPref=zoom/callbackCameraState.zoom;
    c.pitchPref=callbackCameraClamp(basePitch*pitch+callbackCameraState.tilt*Math.PI/180,.2,1.5)/basePitch;
    try{return update.call(this,dt,sim,focus)}
    finally{c.yaw=yaw;c.zoomPref=zoom;c.pitchPref=pitch}
  };
}
function callbackCameraCode(){
  const r=Math.round(callbackCameraState.rotate+180).toString(36).toUpperCase();
  const z=Math.round(callbackCameraState.zoom*100).toString(36).toUpperCase();
  const t=Math.round(callbackCameraState.tilt+35).toString(36).toUpperCase();
  return "CAM-"+r+"-"+z+"-"+t;
}
function callbackCameraSync(){
  const r=document.querySelector('[data-camera-control="rotate"]'),z=document.querySelector('[data-camera-control="zoom"]'),t=document.querySelector('[data-camera-control="tilt"]');
  if(r)r.value=String(Math.round(callbackCameraState.rotate));
  if(z)z.value=String(Math.round(callbackCameraState.zoom*100));
  if(t)t.value=String(Math.round(callbackCameraState.tilt));
  const rv=document.querySelector('[data-camera-value="rotate"]'),zv=document.querySelector('[data-camera-value="zoom"]'),tv=document.querySelector('[data-camera-value="tilt"]');
  if(rv)rv.textContent=Math.round(callbackCameraState.rotate)+"°";
  if(zv)zv.textContent=Math.round(callbackCameraState.zoom*100)+"%";
  if(tv)tv.textContent=Math.round(callbackCameraState.tilt)+"°";
}
function callbackCameraApply(){callbackCameraAdapter(callbackCameraState);callbackCameraSync()}
function callbackCameraSet(next){
  if(next&&Number.isFinite(Number(next.rotate)))callbackCameraState.rotate=callbackCameraClamp(Number(next.rotate),-180,180);
  if(next&&Number.isFinite(Number(next.zoom)))callbackCameraState.zoom=callbackCameraClamp(Number(next.zoom),.6,1.8);
  if(next&&Number.isFinite(Number(next.tilt)))callbackCameraState.tilt=callbackCameraClamp(Number(next.tilt),-35,35);
  callbackCameraApply();return {...callbackCameraState};
}
function callbackCameraLoad(code,persist=true){
  const m=/^CAM-([0-9A-Z]+)-([0-9A-Z]+)-([0-9A-Z]+)$/i.exec(String(code||"").trim());
  if(!m)return false;
  const rotate=parseInt(m[1],36)-180,zoom=parseInt(m[2],36)/100,tilt=parseInt(m[3],36)-35;
  if(!Number.isFinite(rotate)||!Number.isFinite(zoom)||!Number.isFinite(tilt)||rotate<-180||rotate>180||zoom<.6||zoom>1.8||tilt<-35||tilt>35)return false;
  callbackCameraSet({rotate,zoom,tilt});
  if(persist)try{localStorage.setItem("callback-camera:royal-sumo",callbackCameraCode())}catch{}
  return true;
}
function callbackCameraSave(){
  const code=callbackCameraCode();
  try{localStorage.setItem("callback-camera:royal-sumo",code)}catch{}
  const box=document.querySelector("[data-camera-code]");if(box)box.value=code;
  const status=document.querySelector("[data-camera-status]");if(status)status.textContent="Saved "+code;
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(()=>{if(status)status.textContent="Saved + copied "+code}).catch(()=>{});
  return code;
}
function callbackCameraReset(){callbackCameraSet({rotate:0,zoom:1,tilt:0});const status=document.querySelector("[data-camera-status]");if(status)status.textContent="Camera reset to game default."}
function callbackCameraInstall(){
  if(document.getElementById("callbackCameraPanel"))return;
  const style=document.createElement("style");
  style.textContent=".callback-camera-back{position:fixed;inset:0;display:none;place-items:center;padding:18px;background:#02060bb8;z-index:10000;pointer-events:auto}.callback-camera-back.open{display:grid}.callback-camera-card{width:min(94vw,470px);max-height:88vh;overflow:auto;padding:20px;border-radius:22px;border:1px solid #ffffff2b;background:#0b1725f7;color:#fff;box-shadow:0 24px 80px #000a;font-family:Inter,system-ui,sans-serif}.callback-camera-card h2{margin:0 0 6px}.callback-camera-card p{margin:0 0 14px;color:#b9cbd1;font-size:12px;line-height:1.4}.callback-camera-row{display:grid;grid-template-columns:94px 1fr 52px;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #ffffff17}.callback-camera-row input[type=range]{width:100%;accent-color:#f2c85f}.callback-camera-row b{text-align:right;font-size:12px}.callback-camera-code{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.callback-camera-code input{min-width:0;height:42px;border-radius:10px;border:1px solid #ffffff28;background:#06111d;color:#fff;padding:0 10px;font:800 13px ui-monospace,monospace;text-transform:uppercase}.callback-camera-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.callback-camera-actions button,.callback-camera-launch{min-height:42px;border-radius:11px;border:1px solid #ffffff2a;background:#173247;color:#fff;padding:0 12px;font:800 12px system-ui}.callback-camera-actions .primary{border-color:#f2c85f66;background:#5b451c}.callback-camera-status{min-height:18px;margin-top:8px;color:#f2d786;font-size:11px}.callback-camera-setting{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #ffffff18}.callback-camera-setting small{display:block;color:#aebfca;font-size:9px;margin-top:2px}@media(max-width:420px){.callback-camera-row{grid-template-columns:72px 1fr 46px}.callback-camera-card{padding:16px}}";
  document.head.appendChild(style);
  const panel=document.createElement("div");panel.id="callbackCameraPanel";panel.className="callback-camera-back";
  panel.innerHTML='<div class="callback-camera-card" role="dialog" aria-modal="true" aria-label="Camera controls"><h2>Camera Controls</h2><p>Adjust the view without changing game physics. Your current setup can be saved as a reusable camera code.</p><div class="callback-camera-row"><label>Rotate</label><input data-camera-control="rotate" type="range" min="-180" max="180" step="1" value="0"><b data-camera-value="rotate">0°</b></div><div class="callback-camera-row"><label>Zoom</label><input data-camera-control="zoom" type="range" min="60" max="180" step="1" value="100"><b data-camera-value="zoom">100%</b></div><div class="callback-camera-row"><label>Tilt</label><input data-camera-control="tilt" type="range" min="-35" max="35" step="1" value="0"><b data-camera-value="tilt">0°</b></div><div class="callback-camera-code"><input data-camera-code aria-label="Camera save code" placeholder="CAM-..." autocomplete="off" spellcheck="false"><button data-camera-action="load" type="button">Load Code</button></div><div class="callback-camera-actions"><button data-camera-action="reset" type="button">Reset Camera</button><button data-camera-action="save" class="primary" type="button">Save Code</button></div><div class="callback-camera-actions"><button data-camera-action="close" type="button" style="grid-column:1/-1">Close</button></div><div class="callback-camera-status" data-camera-status aria-live="polite"></div></div>';
  document.body.appendChild(panel);
  const launcher=document.createElement("button");launcher.type="button";launcher.className="callback-camera-launch";launcher.textContent="📷 Camera";launcher.setAttribute("aria-label","Open camera controls");
  const host=document.querySelector('[data-ovl="settings"] .st-card');
  if(host){
    if(host.classList.contains("topbar")){
      launcher.classList.add("pill");launcher.textContent="📷";launcher.title="Camera";host.appendChild(launcher);
    }else{
      const row=document.createElement("div");row.className="callback-camera-setting";row.innerHTML="<div><strong>Camera</strong><small>Rotate, zoom, tilt and save camera codes</small></div>";row.appendChild(launcher);
      const buttons=host.querySelector(".st-foot");host.insertBefore(row,buttons||null);
    }
  }else{launcher.style.position="fixed";launcher.style.top="64px";launcher.style.right="8px";launcher.style.zIndex="9000";document.body.appendChild(launcher)}
  launcher.addEventListener("click",()=>{panel.classList.add("open");callbackCameraSync();const box=panel.querySelector("[data-camera-code]");if(box&&!box.value)box.value=callbackCameraCode()});
  panel.querySelector('[data-camera-action="close"]').addEventListener("click",()=>panel.classList.remove("open"));
  panel.addEventListener("pointerdown",e=>{if(e.target===panel)panel.classList.remove("open")});
  panel.querySelectorAll("[data-camera-control]").forEach(el=>el.addEventListener("input",()=>{
    if(el.dataset.cameraControl==="rotate")callbackCameraSet({rotate:Number(el.value)});
    else if(el.dataset.cameraControl==="zoom")callbackCameraSet({zoom:Number(el.value)/100});
    else callbackCameraSet({tilt:Number(el.value)});
  }));
  panel.querySelector('[data-camera-action="reset"]').addEventListener("click",callbackCameraReset);
  panel.querySelector('[data-camera-action="save"]').addEventListener("click",callbackCameraSave);
  panel.querySelector('[data-camera-action="load"]').addEventListener("click",()=>{
    const box=panel.querySelector("[data-camera-code]"),status=panel.querySelector("[data-camera-status]");
    if(callbackCameraLoad(box.value,true)){box.value=callbackCameraCode();status.textContent="Loaded "+box.value}else status.textContent="That camera code is not valid.";
  });
  try{const saved=localStorage.getItem("callback-camera:royal-sumo");if(saved)callbackCameraLoad(saved,false);else callbackCameraApply()}catch{callbackCameraApply()}
}
window.CallbackCamera={get:()=>({...callbackCameraState}),set:callbackCameraSet,reset:callbackCameraReset,code:callbackCameraCode,save:callbackCameraSave,load:callbackCameraLoad};
function install(){
  installRendererAdapter();callbackCameraInstall();
  const resume=document.querySelector('[data-ovl="pause"] button');
  if(resume)resume.setAttribute('data-resume-game','');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();

})();
