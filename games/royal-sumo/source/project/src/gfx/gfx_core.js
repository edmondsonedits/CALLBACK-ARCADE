/* ============================================================================
   ROYAL SUMO - RENDERER CORE  (shaders, textures, camera, draw helpers)
   ========================================================================== */
import {TAU, damp} from '../core/util.js';
import {M4, MB, compileProgram, hexRGB, makeTexture} from './engine.js';
const GLSL_COMMON=`
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
`;
const VS_TOON=`#version 300 es
layout(location=0) in vec3 a_pos;layout(location=1) in vec3 a_nrm;layout(location=2) in vec3 a_on;layout(location=3) in vec2 a_uv;layout(location=4) in vec3 a_col;
layout(location=5) in vec4 i_m0;layout(location=6) in vec4 i_m1;layout(location=7) in vec4 i_m2;layout(location=8) in vec4 i_m3;
layout(location=9) in vec4 i_col;layout(location=10) in vec4 i_p;
uniform mat4 u_vp;uniform vec3 u_eye;uniform float u_ow;uniform float u_outline;
out vec3 v_wp;out vec3 v_n;out vec3 v_bc;out vec2 v_uv;out vec4 v_ic;out vec4 v_ip;
void main(){
  mat4 M=mat4(i_m0,i_m1,i_m2,i_m3);
  vec3 c0=i_m0.xyz,c1=i_m1.xyz,c2=i_m2.xyz;
  vec3 pos=a_pos;
  vec3 n=cross(c1,c2)*a_nrm.x+cross(c2,c0)*a_nrm.y+cross(c0,c1)*a_nrm.z;
  vec4 wp=M*vec4(pos,1.0);
  if(u_outline>.5){
    vec3 on=cross(c1,c2)*a_on.x+cross(c2,c0)*a_on.y+cross(c0,c1)*a_on.z;
    float dist=length(wp.xyz-u_eye);
    wp.xyz+=normalize(on)*u_ow*clamp(dist*.085,.55,2.4);
  }
  v_wp=wp.xyz;v_n=normalize(n);v_bc=a_col*i_col.rgb;v_uv=a_uv;v_ic=i_col;v_ip=i_p;
  gl_Position=u_vp*wp;
}`;
const FS_TOON=`#version 300 es
precision highp float;
in vec3 v_wp;in vec3 v_n;in vec3 v_bc;in vec2 v_uv;in vec4 v_ic;in vec4 v_ip;
uniform vec3 u_eye;uniform vec3 u_ldir;uniform vec3 u_lcol;uniform vec3 u_amb;uniform vec3 u_gnd;uniform vec3 u_rim;
uniform vec3 u_fogc;uniform vec3 u_fog;uniform float u_time;uniform float u_outline;uniform vec3 u_ocol;
uniform sampler2D u_atlas;uniform vec4 u_holes[10];uniform int u_nh;uniform vec3 u_pa;uniform vec3 u_pb;
out vec4 o;
${GLSL_COMMON}
vec3 pattern(int id,vec2 p,float k){
  if(id==1){vec2 c=floor(p*k);float ch=mod(c.x+c.y,2.0);vec2 f=abs(fract(p*k)-.5);float edge=smoothstep(.46,.5,max(f.x,f.y));
    return mix(vec3(1.0),vec3(.74,.8,.95),ch)*(1.0-.25*edge);}
  if(id==2){float r=length(p);float b=abs(fract(r*k)-.5);float ring=smoothstep(.42,.5,b);float a=atan(p.y,p.x);float rune=step(.82,hash12(vec2(floor(r*k),floor(a*7.0))))*step(.15,b)*step(b,.35);
    return vec3(1.0-.28*ring)*(1.0+.35*rune)+vec3(.04)*vnoise(p*3.0);}
  if(id==3){float row=floor(p.y*k);float off=hash12(vec2(row,1.7))*4.0;float col=floor((p.x+off)*k*.45);float seam=smoothstep(.43,.5,abs(fract(p.y*k)-.5));float seam2=smoothstep(.45,.5,abs(fract((p.x+off)*k*.45)-.5));
    float tone=.88+.2*hash12(vec2(col,row));return vec3(tone*(1.0-.34*max(seam,seam2*.8)));}
  if(id==4){float n=fbm(p*k);float crack=smoothstep(.5,.52,abs(fbm(p*k*1.7+9.0)-.5)*2.0+.5)*.0;float v=.86+.28*n;float vein=smoothstep(.015,.0,abs(fbm(p*k*.8)-.5)-.0)*.0;
    return vec3(v)*vec3(1.0,.97,.93);}
  if(id==5){float n=fbm(p*k);float sp=pow(vnoise(p*k*6.0),9.0)*3.0;float st=smoothstep(.0,.02,abs(fract((p.x+p.y)*k*.7)-.5)-.47);
    return vec3(.9+.22*n+sp*.5)+vec3(0.,.03,.05)*st;}
  if(id==6){float n=vnoise(p*k*3.0)*.5+vnoise(p*k*9.0)*.25;return vec3(.9+.2*n);}
  return vec3(1.0);
}
void main(){
  for(int i=0;i<10;i++){if(i>=u_nh)break;vec4 h=u_holes[i];if(distance(v_wp.xz,h.xy)<h.z)discard;}
  if(u_outline>.5){
    float fd=length(v_wp-u_eye);float f=smoothstep(u_fog.x,u_fog.y,fd)*u_fog.z;
    o=vec4(mix(v_bc*.2+u_ocol,u_fogc,f),1.0);return;
  }
  vec3 base=v_bc;
  float atlas=v_ip.y;
  if(atlas>-.5){
    vec2 cell=vec2(mod(atlas,4.0),floor(atlas/4.0));vec4 t=texture(u_atlas,(cell+v_uv)/4.0);
    if(t.a<.45)discard;base=t.rgb*(v_ic.rgb);
  }
  int pat=int(v_ip.z+.5);
  if(pat>0)base*=pattern(pat,v_wp.xz,v_ip.w);
  vec3 N=normalize(v_n);vec3 V=normalize(u_eye-v_wp);
  float ndl=dot(N,u_ldir);
  float t1=smoothstep(-.08,.06,ndl),t2=smoothstep(.34,.5,ndl);
  float lit=t1*.55+t2*.45;
  vec3 amb=mix(u_gnd,u_amb,N.y*.5+.5);
  vec3 col=base*(amb*.66+u_lcol*lit*.62);
  float rim=pow(1.0-max(dot(N,V),0.),3.0);
  col+=u_rim*rim*.38*(.4+.6*t1);
  float sp=step(.965,max(dot(reflect(-u_ldir,N),V),0.))*.20;
  col+=sp*u_lcol*step(.5,v_ip.w*0.+1.0)*(atlas>-.5?0.:1.);
  col=mix(col,base*1.15,v_ic.a);
  col=mix(col,vec3(1.0),clamp(v_ip.x,0.,1.));
  float fd=length(v_wp-u_eye);float f=smoothstep(u_fog.x,u_fog.y,fd)*u_fog.z;
  col=mix(col,u_fogc,f);
  o=vec4(col,1.0);
}`;
const VS_FX=`#version 300 es
layout(location=0) in vec3 a_pos;layout(location=3) in vec2 a_uv;
layout(location=5) in vec4 i_a;layout(location=6) in vec4 i_b;layout(location=7) in vec4 i_c;layout(location=8) in vec4 i_d;
uniform mat4 u_vp;uniform vec3 u_right;uniform vec3 u_up;
out vec2 v_uv;out vec4 v_c;
void main(){
  float rot=i_b.x;float cs=cos(rot),sn=sin(rot);
  vec2 q=vec2(a_pos.x*cs-a_pos.y*sn,a_pos.x*sn+a_pos.y*cs)*i_a.w;
  vec3 w;
  if(i_b.y>1.5){                       // ground ring/disc (flat in XZ)
    w=i_a.xyz+vec3(q.x,0.,q.y);
  }else if(i_b.y>.5){                  // vertical billboard locked to Y (stretches along up)
    w=i_a.xyz+u_right*q.x+vec3(0.,1.,0.)*q.y*(1.0+i_b.w);
  }else{
    w=i_a.xyz+u_right*q.x+u_up*q.y;
  }
  float sprite=i_b.z;
  vec2 cell=vec2(mod(sprite,4.0),floor(sprite/4.0));
  v_uv=(cell+a_uv)/4.0;v_c=i_c;
  gl_Position=u_vp*vec4(w,1.0);
}`;
const FS_FX=`#version 300 es
precision highp float;
in vec2 v_uv;in vec4 v_c;uniform sampler2D u_tex;uniform float u_add;uniform vec3 u_fogc;
out vec4 o;
void main(){
  vec4 t=texture(u_tex,v_uv);float a=t.a*v_c.a;
  if(a<.01)discard;
  vec3 c=t.rgb*v_c.rgb;
  o=u_add>.5?vec4(c*a,0.0):vec4(c,a);
}`;
const VS_SKY=`#version 300 es
out vec2 v_p;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));v_p=p*2.0-1.0;gl_Position=vec4(v_p,.9999,1.0);}`;
const FS_SKY=`#version 300 es
precision highp float;
in vec2 v_p;uniform vec3 u_camR;uniform vec3 u_camU;uniform vec3 u_camF;uniform float u_tanY;uniform float u_asp;uniform float u_shift;uniform float u_shiftX;
uniform vec3 u_top;uniform vec3 u_mid;uniform vec3 u_hor;uniform vec3 u_low;uniform float u_mode;uniform float u_time;uniform vec3 u_sun;uniform vec3 u_sunc;
out vec4 o;
${GLSL_COMMON}
void main(){
  vec2 q=vec2(v_p.x-u_shiftX,v_p.y-u_shift);
  vec3 rd=normalize(u_camF+u_camR*q.x*u_tanY*u_asp+u_camU*q.y*u_tanY);
  float h=rd.y;
  vec3 col=mix(u_hor,u_mid,smoothstep(-.02,.28,h));col=mix(col,u_top,smoothstep(.2,.85,h));
  col=mix(col,u_low,smoothstep(.0,-.25,h));
  float az=atan(rd.z,rd.x);
  // stars
  vec2 sp=vec2(az*60.0,h*120.0);vec2 cell=floor(sp);float sh=hash12(cell);
  float star=step(.985,sh)*smoothstep(.55,.0,length(fract(sp)-.5))*(.6+.4*sin(u_time*2.0+sh*40.0));
  float starAmt=u_mode>.5&&u_mode<2.5||u_mode>3.5?1.0:.0;
  col+=vec3(star)*starAmt*smoothstep(.05,.35,h);
  // sun / moon disc
  float sd=dot(rd,normalize(u_sun));
  col+=u_sunc*(smoothstep(.9965,.9985,sd)*1.1+pow(max(sd,0.),22.0)*.28);
  if(u_mode>.5&&u_mode<1.5){                       // aurora
    float band=0.;
    for(int i=0;i<3;i++){float fi=float(i);float w=sin(az*2.0+u_time*.12+fi*2.1)*.5+sin(az*5.0-u_time*.2+fi)*.25;
      float y=.34+fi*.1+w*.08;band+=smoothstep(.1,.0,abs(h-y))*(.5+.5*sin(az*9.0+u_time*.4+fi*3.0))*.55;}
    col+=mix(vec3(.1,.9,.55),vec3(.55,.25,.95),smoothstep(.3,.6,h))*band*.55*smoothstep(.1,.3,h);
  }
  if(u_mode>1.5&&u_mode<2.5){                       // neon horizon bars
    float g=smoothstep(.02,.0,abs(fract(h*14.0-u_time*.05)-.5)-.46)*smoothstep(.45,.0,h)*smoothstep(-.02,.05,h);
    col+=mix(vec3(1.,.2,.7),vec3(.1,.9,1.),sin(az*3.0)*.5+.5)*g*.55;
  }
  if(u_mode>2.5&&u_mode<3.5){                       // soft clouds
    float c=fbm(vec2(az*3.0+u_time*.01,h*8.0))*smoothstep(.0,.2,h)*smoothstep(.55,.2,h);
    col=mix(col,u_hor*1.18+vec3(.1,.04,0.),smoothstep(.45,.75,c)*.55);
  }
  if(u_mode>3.5&&u_mode<4.5){                       // jungle haze streaks
    float c=fbm(vec2(az*2.0,h*5.0-u_time*.01));col=mix(col,u_hor,smoothstep(.4,.7,c)*.35*smoothstep(.35,.0,h));
  }
  o=vec4(col,1.0);
}`;
const VS_LIQ=`#version 300 es
layout(location=0) in vec3 a_pos;uniform mat4 u_vp;uniform float u_y;uniform float u_size;
out vec3 v_wp;
void main(){vec3 w=vec3(a_pos.x*u_size,u_y,a_pos.z*u_size);v_wp=w;gl_Position=u_vp*vec4(w,1.0);}`;
const FS_LIQ=`#version 300 es
precision highp float;
in vec3 v_wp;uniform vec3 u_eye;uniform float u_time;uniform float u_mode;uniform float u_R;
uniform vec3 u_la;uniform vec3 u_lb;uniform vec3 u_lc;uniform vec3 u_ld;uniform vec3 u_fogc;uniform vec3 u_fog;uniform vec4 u_glow;
out vec4 o;
${GLSL_COMMON}
void main(){
  vec2 p=v_wp.xz;float d=length(p);float t=u_time;
  vec3 col;
  if(u_mode<.5){                                    // lava
    vec2 q=p*.35+vec2(t*.04,-t*.03);float n=fbm(q+fbm(q*1.7+t*.05)*1.2);
    float crack=smoothstep(.05,.0,abs(n-.5))*.9+smoothstep(.09,.01,abs(fbm(q*2.3-t*.04)-.5))*.35;
    col=mix(u_la,u_lb,smoothstep(.25,.7,n));col=mix(col,u_lc,clamp(crack,0.,1.));
    col+=u_ld*smoothstep(1.6,0.,d-u_R)*.65;
  }else if(u_mode<1.5){                             // icy water
    vec2 q=p*.5;float w=fbm(q+vec2(t*.05,t*.03))*.7+fbm(q*2.2-vec2(t*.07,0.))*.3;
    col=mix(u_la,u_lb,w);col+=u_lc*smoothstep(.64,.82,fbm(q*3.2+vec2(t*.09,-t*.06)))*.9;
    float foam=smoothstep(2.0,0.0,d-u_R)*(.5+.5*vnoise(p*3.0+t*.5));col=mix(col,u_ld,foam*.55);
  }else if(u_mode<2.5){                             // neon void grid
    vec2 g=p*.7;vec2 gl=smoothstep(.07,.0,abs(fract(g)-.5)-.43);float line=max(gl.x,gl.y);
    float fade=smoothstep(34.0,6.0,d);col=mix(u_la,u_lb,smoothstep(0.,26.,d));
    col+=mix(u_lc,u_ld,sin(d*.25-t*.8)*.5+.5)*line*fade*.8;
    col+=u_ld*smoothstep(2.4,0.,d-u_R)*.5;
  }else if(u_mode<3.5){                             // sea
    vec2 q=p*.45;float w=fbm(q+vec2(t*.06,t*.04));float w2=fbm(q*2.4-vec2(t*.1,t*.03));
    col=mix(u_la,u_lb,w);col+=u_lc*smoothstep(.62,.8,w2)*.55;
    float foam=smoothstep(1.8,0.,d-u_R)*(.45+.55*vnoise(p*2.5+t*.6));col=mix(col,u_ld,foam*.6);
  }else if(u_mode<4.5){                             // murky jungle pit
    vec2 q=p*.4;float w=fbm(q+vec2(t*.03,-t*.02));col=mix(u_la,u_lb,w);
    col+=u_lc*smoothstep(.55,.85,fbm(q*2.0+t*.05))*.45;col+=u_ld*smoothstep(2.4,0.,d-u_R)*.35;
  }else{                                            // canyon floor with glowing cracks
    vec2 q=p*.3;float n=fbm(q);float c=smoothstep(.06,.0,abs(fbm(q*2.6)-.5)-.0)+smoothstep(.1,.0,abs(fbm(q*1.2+4.0)-.5));
    col=mix(u_la,u_lb,n);col+=u_lc*clamp(c,0.,1.)*(.7+.3*sin(t*1.3+n*9.0));
    col+=u_ld*smoothstep(3.0,0.,d-u_R)*.25;
  }
  float fd=length(v_wp-u_eye);float f=smoothstep(u_fog.x,u_fog.y,fd)*u_fog.z;
  col=mix(col,u_fogc,f);
  o=vec4(col,1.0);
}`;

/* face atlas (4x4, 128px cells) + fx sprite atlas (4x4, 64px cells) -- drawn with canvas 2D */
function makeFaceAtlas(){
  const S=128,cv=document.createElement('canvas');cv.width=cv.height=S*4;const g=cv.getContext('2d');
  const ink='#2a1a14',cheek='rgba(255,120,120,.55)';
  const cell=(i,fn)=>{g.save();g.translate((i%4)*S,Math.floor(i/4)*S);g.beginPath();g.rect(0,0,S,S);g.clip();fn();g.restore()};
  const eye=(x,y,r,pr,dx,dy)=>{g.fillStyle='#fff';g.beginPath();g.ellipse(x,y,r,r*1.18,0,0,TAU);g.fill();g.lineWidth=3;g.strokeStyle=ink;g.stroke();g.fillStyle=ink;g.beginPath();g.arc(x+(dx||0),y+(dy||0),pr,0,TAU);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(x+(dx||0)-pr*.3,y+(dy||0)-pr*.35,pr*.32,0,TAU);g.fill()};
  const brow=(x1,y1,x2,y2,w)=>{g.strokeStyle=ink;g.lineWidth=w||7;g.lineCap='round';g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()};
  const blush=()=>{g.fillStyle=cheek;g.beginPath();g.ellipse(26,80,13,8,0,0,TAU);g.fill();g.beginPath();g.ellipse(102,80,13,8,0,0,TAU);g.fill()};
  const mouth=(path,fill)=>{g.lineWidth=5;g.strokeStyle=ink;g.lineCap='round';g.lineJoin='round';g.beginPath();path();if(fill){g.fillStyle=fill;g.fill()}g.stroke()};
  cell(0,()=>{eye(42,56,13,7,1,1);eye(86,56,13,7,-1,1);brow(26,36,56,33);brow(72,33,102,36);blush();mouth(()=>{g.moveTo(52,86);g.quadraticCurveTo(64,96,76,86)})});             // neutral
  cell(1,()=>{eye(42,58,12,7,2,0);eye(86,58,12,7,-2,0);brow(24,30,56,42,8);brow(72,42,104,30,8);blush();mouth(()=>{g.moveTo(46,92);g.lineTo(82,92)})});                           // determined
  cell(2,()=>{eye(42,56,13,8,3,0);eye(86,56,13,8,-3,0);brow(22,28,58,44,9);brow(70,44,106,28,9);blush();mouth(()=>{g.moveTo(44,84);g.quadraticCurveTo(64,118,84,84);g.closePath()},'#7a1d2b')}); // charging yell
  cell(3,()=>{g.strokeStyle=ink;g.lineWidth=8;g.lineCap='round';[[42,56],[86,56]].forEach(([x,y],k)=>{const s=k?-1:1;g.beginPath();g.moveTo(x-12*s,y-12);g.lineTo(x+10*s,y);g.lineTo(x-12*s,y+12);g.stroke()});brow(24,34,56,28);brow(72,28,104,34);mouth(()=>{g.ellipse(64,92,11,13,0,0,TAU)},'#7a1d2b')});   // hit
  cell(4,()=>{[[42,56],[86,56]].forEach(([x,y])=>{g.strokeStyle=ink;g.lineWidth=5;g.beginPath();for(let a=0;a<14;a+=.2){const r=1+a*1.05;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;a===0?g.moveTo(px,py):g.lineTo(px,py)}g.stroke()});mouth(()=>{g.moveTo(46,96);g.quadraticCurveTo(54,88,64,96);g.quadraticCurveTo(74,104,82,94)});g.fillStyle='#ff7a90';g.beginPath();g.ellipse(70,104,8,10,0,0,TAU);g.fill()}); // dizzy
  cell(5,()=>{eye(42,54,16,4,0,-2);eye(86,54,16,4,0,-2);brow(24,28,54,22);brow(74,22,104,28);mouth(()=>{g.moveTo(46,98);g.quadraticCurveTo(54,86,64,98);g.quadraticCurveTo(74,110,82,98)})});     // scared
  cell(6,()=>{g.strokeStyle=ink;g.lineWidth=8;g.lineCap='round';g.beginPath();g.arc(42,60,12,Math.PI*1.1,Math.PI*1.9);g.stroke();g.beginPath();g.arc(86,60,12,Math.PI*1.1,Math.PI*1.9);g.stroke();blush();mouth(()=>{g.moveTo(40,80);g.quadraticCurveTo(64,118,88,80);g.closePath()},'#7a1d2b')}); // happy
  cell(7,()=>{eye(42,60,13,7,3,2);eye(86,60,13,7,3,2);g.fillStyle='rgba(235,200,160,.0)';brow(24,44,56,48,8);brow(72,48,104,44,8);g.fillStyle='#e9c9a3';g.fillRect(26,40,34,14);g.fillRect(70,40,34,14);brow(24,52,58,52,5);brow(70,52,104,52,5);blush();mouth(()=>{g.moveTo(48,90);g.quadraticCurveTo(70,100,84,84)})}); // smug
  cell(8,()=>{eye(42,60,12,6,0,3);eye(86,60,12,6,0,3);brow(26,40,56,34);brow(72,34,102,40);g.fillStyle='#8ad4ff';g.beginPath();g.ellipse(100,72,6,10,0,0,TAU);g.fill();mouth(()=>{g.moveTo(48,98);g.quadraticCurveTo(64,84,80,98)})});    // sad
  cell(9,()=>{g.strokeStyle=ink;g.lineWidth=7;g.lineCap='round';g.beginPath();g.moveTo(30,58);g.lineTo(54,58);g.stroke();g.beginPath();g.moveTo(74,58);g.lineTo(98,58);g.stroke();blush();mouth(()=>{g.moveTo(52,86);g.quadraticCurveTo(64,94,76,86)})}); // blink
  cell(10,()=>{eye(42,54,12,7,1,1);eye(86,54,12,7,-1,1);brow(26,32,56,28);brow(72,28,102,32);mouth(()=>{g.ellipse(64,92,9,8,0,0,TAU)},'#7a1d2b')}); // oh
  return cv;
}
function makeFxAtlas(){
  const S=64,cv=document.createElement('canvas');cv.width=cv.height=S*4;const g=cv.getContext('2d');
  const cell=(i,fn)=>{g.save();g.translate((i%4)*S,Math.floor(i/4)*S);g.beginPath();g.rect(0,0,S,S);g.clip();fn();g.restore()};
  cell(0,()=>{const gr=g.createRadialGradient(32,32,0,32,32,30);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.5,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,S,S)});   // soft glow
  cell(1,()=>{g.fillStyle='#fff';g.beginPath();for(let i=0;i<8;i++){const a=i/8*TAU-Math.PI/2,r=i%2?7:29;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}g.closePath();g.fill()});                                              // 4-point star
  cell(2,()=>{g.strokeStyle='#fff';g.lineWidth=5;g.beginPath();g.arc(32,32,26,0,TAU);g.stroke();const gr=g.createRadialGradient(32,32,18,32,32,30);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,.35)');g.fillStyle=gr;g.fillRect(0,0,S,S)}); // ring
  cell(3,()=>{for(let i=0;i<7;i++){const gr=g.createRadialGradient(20+Math.random()*24,20+Math.random()*24,0,32,32,14+Math.random()*8);gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,S,S)}});     // smoke puff
  cell(4,()=>{const gr=g.createLinearGradient(0,32,64,32);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.ellipse(32,32,30,5,0,0,TAU);g.fill()});   // streak
  cell(5,()=>{g.fillStyle='#fff';g.beginPath();for(let i=0;i<16;i++){const a=i/16*TAU,r=i%2?15:30;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}g.closePath();g.fill();g.strokeStyle='rgba(0,0,0,.0)'});       // comic burst
  cell(6,()=>{g.strokeStyle='#fff';g.lineWidth=3;g.lineCap='round';for(let i=0;i<3;i++){const a=i/3*Math.PI;g.beginPath();g.moveTo(32-Math.cos(a)*26,32-Math.sin(a)*26);g.lineTo(32+Math.cos(a)*26,32+Math.sin(a)*26);g.stroke();for(const s of[-1,1]){g.beginPath();g.moveTo(32+Math.cos(a)*s*16-Math.sin(a)*6,32+Math.sin(a)*s*16+Math.cos(a)*6);g.lineTo(32+Math.cos(a)*s*20,32+Math.sin(a)*s*20);g.lineTo(32+Math.cos(a)*s*16+Math.sin(a)*6,32+Math.sin(a)*s*16-Math.cos(a)*6);g.stroke()}}});   // snowflake
  cell(7,()=>{g.fillStyle='#fff';g.beginPath();g.ellipse(32,32,22,22,0,0,TAU);g.fill()});                                                                                                                      // hard disc
  cell(8,()=>{g.fillStyle='#fff';g.beginPath();g.moveTo(32,6);g.quadraticCurveTo(54,32,32,58);g.quadraticCurveTo(10,32,32,6);g.fill()});                                                                          // leaf / flame drop
  cell(9,()=>{const gr=g.createRadialGradient(32,32,0,32,32,30);gr.addColorStop(0,'rgba(255,255,255,.0)');gr.addColorStop(.55,'rgba(255,255,255,0)');gr.addColorStop(.82,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,S,S)});   // thick soft ring (telegraph)
  cell(10,()=>{g.fillStyle='#fff';g.fillRect(8,8,48,48)});                                                                                                                                                         // confetti square
  cell(11,()=>{g.fillStyle='#fff';g.beginPath();g.moveTo(32,6);g.lineTo(58,56);g.lineTo(6,56);g.closePath();g.fill()});                                                                                           // triangle (arrow)
  cell(12,()=>{const gr=g.createRadialGradient(32,32,0,32,32,31);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(.7,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,S,S)}); // shadow blob
  return cv;
}

/* ============================================================== Renderer == */
export class Renderer{
  constructor(canvas,opts){
    opts=opts||{};this.canvas=canvas;
    const attrs={antialias:opts.aa!==false,alpha:false,depth:true,stencil:false,powerPreference:'high-performance',preserveDrawingBuffer:!!opts.preserve,failIfMajorPerformanceCaveat:false};
    const gl=canvas.getContext('webgl2',attrs);
    if(!gl)throw new Error('WebGL2 is not available');
    this.gl=gl;this.time=0;this.w=1;this.h=1;this.dprScale=1;this.stats={draws:0,tris:0};
    this.prog={
      toon:compileProgram(gl,VS_TOON,FS_TOON,'toon'),fx:compileProgram(gl,VS_FX,FS_FX,'fx'),
      sky:compileProgram(gl,VS_SKY,FS_SKY,'sky'),liq:compileProgram(gl,VS_LIQ,FS_LIQ,'liq')
    };
    this.faceTex=makeTexture(gl,makeFaceAtlas(),{mips:true});
    this.fxTex=makeTexture(gl,makeFxAtlas(),{mips:true});
    this.emptyVao=gl.createVertexArray();
    // meshes shared by everything
    this.quadMesh=(()=>{const m=new MB();m.v(-.5,-.5,0,0,0,1,0,0,1,1,1);m.v(.5,-.5,0,0,0,1,1,0,1,1,1);m.v(.5,.5,0,0,0,1,1,1,1,1,1);m.v(-.5,.5,0,0,0,1,0,1,1,1,1);m.quad(0,1,2,3);return m.build(gl)})();
    this.liqMesh=(()=>{const m=new MB();m.v(-1,0,-1,0,1,0,0,0,1,1,1);m.v(1,0,-1,0,1,0,1,0,1,1,1);m.v(1,0,1,0,1,0,1,1,1,1,1);m.v(-1,0,1,0,1,0,0,1,1,1,1);m.quad(0,1,2,3);return m.build(gl)})();
    this.liqVao=gl.createVertexArray();gl.bindVertexArray(this.liqVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.liqMesh.vbo);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,56,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.liqMesh.ibo);gl.bindVertexArray(null);
    this.vp=new Float32Array(16);this.view=new Float32Array(16);this.proj=new Float32Array(16);
    this.cam={fov:34*Math.PI/180,pitch:.98,yaw:0,dist:16,tx:0,ty:0,tz:0,fx:0,fz:0,fdist:16,trauma:0,punch:0,zoomPref:1,pitchPref:1,
              shiftY:0,shiftX:0,msx:0,msy:0,mz:1,menuView:null,eye:[0,10,10],shakeX:0,shakeY:0,rollShake:0,orbit:0,mode:'game',R:6.5,margin:1.04};
    this.theme=null;this.dynamic=[];this.fog=[0,0,0];
    this.settings={shake:1,quality:'high',outline:true,fogOn:true,cameraMode:'dynamic',names:true};
    this.holes=new Float32Array(40);this.nHoles=0;
    this.lost=false;
    this._hLost=e=>{e.preventDefault();this.lost=true;if(this.onLost)this.onLost()};
    this._hRestored=()=>{this.lost=false;if(this.onRestored)this.onRestored()};
    canvas.addEventListener('webglcontextlost',this._hLost,false);
    canvas.addEventListener('webglcontextrestored',this._hRestored,false);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  }
  /** Stop listening for context events (call before replacing this renderer, or handlers pile up on every restore). */
  detach(){
    this.canvas.removeEventListener('webglcontextlost',this._hLost,false);
    this.canvas.removeEventListener('webglcontextrestored',this._hRestored,false);
    this.onLost=this.onRestored=null;
  }
  resize(cssW,cssH,dpr,scale){
    const d=Math.max(.5,Math.min(dpr||1,2.5))*(scale||1);
    const w=Math.max(2,Math.floor(cssW*d)),h=Math.max(2,Math.floor(cssH*d));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
    this.w=w;this.h=h;this.aspect=w/h;
  }
  /* ---------------------------------------------------------- camera ---- */
  fitDist(R,pitch,asp,shiftY,fov,margin){
    const tanV=Math.tan(fov/2),tanH=tanV*asp;
    const lim=[.95,.9];let lo=5,hi=90;
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    const pts=[];for(let i=0;i<16;i++){const a=i/16*TAU;pts.push([Math.cos(a)*R,Math.sin(a)*R])}
    const ok=d=>{
      // camera at (0, d*sp, d*cp) looking at origin
      const ex=0,ey=d*sp,ez=d*cp,fx=0,fy=-sp,fz=-cp,ux=0,uy=cp,uz=-sp;
      for(const p of pts){
        const vx=p[0]-ex,vy=0-ey,vz=p[1]-ez;const zc=vx*fx+vy*fy+vz*fz;if(zc<=.1)return false;
        const xc=vx,yc=vx*0+vy*uy+vz*uz;
        const nx=xc/(zc*tanH),ny=yc/(zc*tanV)+shiftY;
        if(Math.abs(nx)>lim[0]||ny>lim[1]||ny<-lim[1])return false;
      }
      return true;
    };
    for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(ok(mid))hi=mid;else lo=mid}
    return hi*margin;
  }
  updateCamera(dt,sim,focus){
    const c=this.cam,asp=this.aspect||1;
    const portrait=asp<.85;
    const mv=c.menuView,kk=1-Math.exp(-3.2*dt);
    c.msx+=((mv?mv.x:0)-c.msx)*kk;c.msy+=((mv?mv.y:0)-c.msy)*kk;c.mz+=((mv&&mv.zoom||1)-c.mz)*kk;
    c.shiftY=(portrait?.16:(asp<1.3?.08:.0))+c.msy;c.shiftX=c.msx;
    let R=c.R;
    // pitch: a touch steeper in portrait so the whole ring reads
    const pitch=(portrait?.95:.86)*c.pitchPref;
    c.pitch=damp(c.pitch,pitch,4,dt);
    const want=this.fitDist(R,c.pitch,asp,c.shiftY,c.fov,c.margin)*c.zoomPref*c.mz*(1-c.punch*.1);
    c.dist=c.mode==='game'?damp(c.dist,want,2.6,dt):damp(c.dist,want,2.0,dt);
    c.punch=Math.max(0,c.punch-dt*2.2);
    // look-at: drifts toward the action a little
    let tx=0,tz=0;
    if(focus){tx=focus.x*.12;tz=focus.z*.12}
    c.tx=damp(c.tx,tx,2.5,dt);c.tz=damp(c.tz,tz,2.5,dt);
    // trauma shake
    c.trauma=Math.max(0,c.trauma-dt*1.35);
    const sh=c.trauma*c.trauma*this.settings.shake;
    const tt=this.time*38;
    c.shakeX=(Math.sin(tt*1.13)+Math.sin(tt*2.37+1.3)*.6)*.22*sh;
    c.shakeY=(Math.sin(tt*1.71+2.0)+Math.sin(tt*3.1)*.6)*.18*sh;
    c.rollShake=Math.sin(tt*1.9)*.012*sh;
    const yaw=c.yaw+c.orbit;
    const cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
    const ex=c.tx+Math.sin(yaw)*cp*c.dist,ey=c.ty+sp*c.dist,ez=c.tz+Math.cos(yaw)*cp*c.dist;
    c.eye=[ex+c.shakeX,ey+c.shakeY,ez];
    M4.look(this.view,c.eye[0],c.eye[1],c.eye[2],c.tx+c.shakeX*.5,c.ty+c.shakeY*.5,c.tz);
    M4.persp(this.proj,c.fov,asp,.5,260);
    this.proj[8]=-c.shiftX;this.proj[9]=-c.shiftY;                     // lens shift: lifts the arena above the thumbs
    M4.mul(this.vp,this.proj,this.view);
    this.basis=this.view._basis;
  }
  addTrauma(a){this.cam.trauma=Math.min(1,this.cam.trauma+a)}
  /* project a world point to CSS pixels (for DOM labels). returns null when behind the camera */
  project(x,y,z,out){
    const m=this.vp;const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(cw<=.01)return null;
    out=out||{};out.x=(cx/cw*.5+.5);out.y=(1-(cy/cw*.5+.5));out.w=cw;return out;
  }
  /* ------------------------------------------------------------ draw ---- */
  setTheme(theme){this.theme=theme;this.fog=hexRGB(theme.fog.color)}
  beginFrame(dt){
    const gl=this.gl;this.time+=dt;this.stats.draws=0;
    gl.viewport(0,0,this.w,this.h);gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
    const f=this.fog;gl.clearColor(f[0],f[1],f[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  }
  drawSky(){
    const gl=this.gl,T=this.theme.sky,p=this.prog.sky,b=this.basis;
    gl.useProgram(p.p);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    gl.uniform3f(p.u('u_camR'),b[0],b[1],b[2]);gl.uniform3f(p.u('u_camU'),b[3],b[4],b[5]);gl.uniform3f(p.u('u_camF'),b[6],b[7],b[8]);
    gl.uniform1f(p.u('u_tanY'),Math.tan(this.cam.fov/2));gl.uniform1f(p.u('u_asp'),this.aspect);gl.uniform1f(p.u('u_shift'),this.cam.shiftY);gl.uniform1f(p.u('u_shiftX'),this.cam.shiftX||0);
    gl.uniform3fv(p.u('u_top'),T.top);gl.uniform3fv(p.u('u_mid'),T.mid);gl.uniform3fv(p.u('u_hor'),T.hor);gl.uniform3fv(p.u('u_low'),T.low);
    gl.uniform1f(p.u('u_mode'),T.mode);gl.uniform1f(p.u('u_time'),this.time);gl.uniform3fv(p.u('u_sun'),T.sun);gl.uniform3fv(p.u('u_sunc'),T.sunc);
    gl.bindVertexArray(this.emptyVao);gl.drawArrays(gl.TRIANGLES,0,3);this.stats.draws++;
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
  }
  drawLiquid(){
    const gl=this.gl,L=this.theme.liquid,p=this.prog.liq;
    gl.useProgram(p.p);gl.uniformMatrix4fv(p.u('u_vp'),false,this.vp);gl.uniform1f(p.u('u_y'),L.y);gl.uniform1f(p.u('u_size'),260);
    gl.uniform3fv(p.u('u_eye'),this.cam.eye);gl.uniform1f(p.u('u_time'),this.time);gl.uniform1f(p.u('u_mode'),L.mode);gl.uniform1f(p.u('u_R'),this.cam.R-1);
    gl.uniform3fv(p.u('u_la'),L.a);gl.uniform3fv(p.u('u_lb'),L.b);gl.uniform3fv(p.u('u_lc'),L.c);gl.uniform3fv(p.u('u_ld'),L.d);
    gl.uniform3fv(p.u('u_fogc'),this.fog);gl.uniform3f(p.u('u_fog'),this.theme.fog.start,this.theme.fog.end,this.theme.fog.amt);
    gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.liqVao);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_INT,0);this.stats.draws++;gl.enable(gl.CULL_FACE);
  }
  toonUniforms(outline,holes){
    const gl=this.gl,p=this.prog.toon,T=this.theme;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u('u_vp'),false,this.vp);gl.uniform3fv(p.u('u_eye'),this.cam.eye);
    gl.uniform1f(p.u('u_outline'),outline?1:0);gl.uniform1f(p.u('u_ow'),T.outlineW||.028);gl.uniform3fv(p.u('u_ocol'),T.outlineCol||[0.02,0.01,0.03]);
    gl.uniform3fv(p.u('u_ldir'),T.light.dir);gl.uniform3fv(p.u('u_lcol'),T.light.col);gl.uniform3fv(p.u('u_amb'),T.light.amb);
    gl.uniform3fv(p.u('u_gnd'),T.light.gnd);gl.uniform3fv(p.u('u_rim'),T.light.rim);
    gl.uniform3fv(p.u('u_fogc'),this.fog);gl.uniform3f(p.u('u_fog'),T.fog.start,T.fog.end,T.fog.amt);gl.uniform1f(p.u('u_time'),this.time);
    const nh=holes?this.nHoles:0;gl.uniform1i(p.u('u_nh'),nh);if(nh)gl.uniform4fv(p.u('u_holes'),this.holes);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.faceTex);gl.uniform1i(p.u('u_atlas'),0);
  }
  /* draw a list of {batch,outline} entries: fills first, then outlines */
  drawToon(list,opts){
    const gl=this.gl,hl=!!(opts&&opts.holes);
    this.toonUniforms(false,hl);gl.cullFace(gl.BACK);gl.disable(gl.BLEND);
    for(const d of list){if(d.batch.n){d.batch.draw();this.stats.draws++}}
    if(this.settings.outline){
      this.toonUniforms(true,hl);gl.cullFace(gl.FRONT);
      for(const d of list){if(d.outline!==false&&d.outline!==0&&d.batch.n&&d.outline){d.batch.draw();this.stats.draws++}}
      gl.cullFace(gl.BACK);
    }
  }
  drawFx(alphaBatch,addBatch,flatFirst){
    const gl=this.gl,p=this.prog.fx,b=this.basis;
    gl.useProgram(p.p);gl.uniformMatrix4fv(p.u('u_vp'),false,this.vp);gl.uniform3f(p.u('u_right'),b[0],b[1],b[2]);gl.uniform3f(p.u('u_up'),b[3],b[4],b[5]);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.fxTex);gl.uniform1i(p.u('u_tex'),0);
    gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.depthMask(false);
    if(alphaBatch&&alphaBatch.n){gl.uniform1f(p.u('u_add'),0);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);alphaBatch.draw();this.stats.draws++}
    if(addBatch&&addBatch.n){gl.uniform1f(p.u('u_add'),1);gl.blendFunc(gl.ONE,gl.ONE);addBatch.draw();this.stats.draws++}
    gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  }
  setHoles(list){
    this.nHoles=Math.min(10,list.length);
    for(let i=0;i<this.nHoles;i++){this.holes[i*4]=list[i].x;this.holes[i*4+1]=list[i].z;this.holes[i*4+2]=list[i].r;this.holes[i*4+3]=0}
  }
}
