/* ============================================================================
   ROYAL SUMO - ENGINE  (tiny WebGL2 toolkit: matrices, meshes, instanced batches)
   Vertex layout (56 B): pos3 nrm3 outlineNrm3 uv2 col3.  Instance layout (96 B):
   mat4 (16f), col4 (rgb + emissive), p4 (flash, atlasIdx, custom0, custom1)
   ========================================================================== */
import {TAU} from '../core/util.js';
export const M4={
  ident(o){for(let i=0;i<16;i++)o[i]=0;o[0]=o[5]=o[10]=o[15]=1;return o},
  mul(o,a,b){
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    for(let c=0;c<4;c++){
      const b0=b[c*4],b1=b[c*4+1],b2=b[c*4+2],b3=b[c*4+3];
      o[c*4]=a00*b0+a10*b1+a20*b2+a30*b3;o[c*4+1]=a01*b0+a11*b1+a21*b2+a31*b3;
      o[c*4+2]=a02*b0+a12*b1+a22*b2+a32*b3;o[c*4+3]=a03*b0+a13*b1+a23*b2+a33*b3;
    }
    return o;
  },
  persp(o,fovy,asp,n,f){
    const t=1/Math.tan(fovy/2);
    for(let i=0;i<16;i++)o[i]=0;
    o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;
  },
  look(o,ex,ey,ez,tx,ty,tz){                       // right-handed view, up = +Y
    let fx=tx-ex,fy=ty-ey,fz=tz-ez;let l=Math.hypot(fx,fy,fz)||1;fx/=l;fy/=l;fz/=l;
    let rx=fy*0-fz*1,ry=fz*0-fx*0,rz=fx*1-fy*0;                 // f x up(0,1,0)
    rx=-fz;ry=0;rz=fx;l=Math.hypot(rx,ry,rz);
    if(l<1e-5){rx=1;ry=0;rz=0}else{rx/=l;ry/=l;rz/=l}
    const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx;
    o[0]=rx;o[1]=ux;o[2]=-fx;o[3]=0;o[4]=ry;o[5]=uy;o[6]=-fy;o[7]=0;o[8]=rz;o[9]=uz;o[10]=-fz;o[11]=0;
    o[12]=-(rx*ex+ry*ey+rz*ez);o[13]=-(ux*ex+uy*ey+uz*ez);o[14]=(fx*ex+fy*ey+fz*ez);o[15]=1;
    o._basis=[rx,ry,rz,ux,uy,uz,fx,fy,fz];return o;
  },
  /* translate / yaw(Y) pitch(X) roll(Z) / scale -> 16 floats at out[off..] ; R = Ry*Rx*Rz */
  trs(out,off,tx,ty,tz,yaw,pitch,roll,sx,sy,sz){
    const cy=Math.cos(yaw),sy_=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
    out[off]=(cy*cr+sy_*sp*sr)*sx;out[off+1]=cp*sr*sx;out[off+2]=(-sy_*cr+cy*sp*sr)*sx;out[off+3]=0;
    out[off+4]=(-cy*sr+sy_*sp*cr)*sy;out[off+5]=cp*cr*sy;out[off+6]=(sy_*sr+cy*sp*cr)*sy;out[off+7]=0;
    out[off+8]=sy_*cp*sz;out[off+9]=-sp*sz;out[off+10]=cy*cp*sz;out[off+11]=0;
    out[off+12]=tx;out[off+13]=ty;out[off+14]=tz;out[off+15]=1;
  },
  xformPoint(m,x,y,z,o){o[0]=m[0]*x+m[4]*y+m[8]*z+m[12];o[1]=m[1]*x+m[5]*y+m[9]*z+m[13];o[2]=m[2]*x+m[6]*y+m[10]*z+m[14];return o}
};

/* ---------------------------------------------------------------- meshes -- */
export class MB{                                         // mesh builder (CPU side)
  constructor(){this.p=[];this.n=[];this.u=[];this.c=[];this.idx=[]}
  v(x,y,z,nx,ny,nz,u,v,r,g,b){const i=this.p.length/3;this.p.push(x,y,z);this.n.push(nx,ny,nz);this.u.push(u||0,v||0);this.c.push(r,g,b);return i}
  t(a,b,c){this.idx.push(a,b,c)}
  quad(a,b,c,d){this.idx.push(a,b,c,a,c,d)}
  get verts(){return this.p.length/3}
  /* bake a transform (16 floats) into the vertices; optional per-channel colour multiplier */
  xf(m,tint){
    const P=this.p,N=this.n,C=this.c;
    // normal matrix = cofactor of upper 3x3 (correct under non-uniform scale)
    const c0x=m[0],c0y=m[1],c0z=m[2],c1x=m[4],c1y=m[5],c1z=m[6],c2x=m[8],c2y=m[9],c2z=m[10];
    const k0x=c1y*c2z-c1z*c2y,k0y=c1z*c2x-c1x*c2z,k0z=c1x*c2y-c1y*c2x;
    const k1x=c2y*c0z-c2z*c0y,k1y=c2z*c0x-c2x*c0z,k1z=c2x*c0y-c2y*c0x;
    const k2x=c0y*c1z-c0z*c1y,k2y=c0z*c1x-c0x*c1z,k2z=c0x*c1y-c0y*c1x;
    for(let i=0;i<P.length;i+=3){
      const x=P[i],y=P[i+1],z=P[i+2];
      P[i]=m[0]*x+m[4]*y+m[8]*z+m[12];P[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];P[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
      const nx=N[i],ny=N[i+1],nz=N[i+2];
      let ax=k0x*nx+k1x*ny+k2x*nz,ay=k0y*nx+k1y*ny+k2y*nz,az=k0z*nx+k1z*ny+k2z*nz;
      const l=Math.hypot(ax,ay,az)||1;N[i]=ax/l;N[i+1]=ay/l;N[i+2]=az/l;
      if(tint){C[i]*=tint[0];C[i+1]*=tint[1];C[i+2]*=tint[2]}
    }
    return this;
  }
  add(o,m,tint){                                  // merge another builder (optionally transformed / tinted)
    let src=o;
    if(m||tint){src=new MB();src.p=o.p.slice();src.n=o.n.slice();src.u=o.u.slice();src.c=o.c.slice();src.idx=o.idx.slice();src.xf(m||M4.ident(new Float32Array(16)),tint)}
    const base=this.p.length/3;
    for(let i=0;i<src.p.length;i++){this.p.push(src.p[i]);this.n.push(src.n[i]);this.c.push(src.c[i])}
    for(let i=0;i<src.u.length;i++)this.u.push(src.u[i]);
    for(let i=0;i<src.idx.length;i++)this.idx.push(src.idx[i]+base);
    return this;
  }
  /* flip any triangle whose winding disagrees with its vertex normals (so primitives cannot be inside-out) */
  fixWinding(){
    const P=this.p,N=this.n,I=this.idx;
    for(let t=0;t<I.length;t+=3){
      const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3;
      const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
      const gx=uy*vz-uz*vy,gy=uz*vx-ux*vz,gz=ux*vy-uy*vx;
      const nx=N[a]+N[b]+N[c],ny=N[a+1]+N[b+1]+N[c+1],nz=N[a+2]+N[b+2]+N[c+2];
      if(gx*nx+gy*ny+gz*nz<0){const tmp=I[t+1];I[t+1]=I[t+2];I[t+2]=tmp}
    }
    return this;
  }
  /* smoothed normals welded by position -> outline direction that keeps hard-edged solids closed */
  outlineNormals(){
    const P=this.p,N=this.n,m=new Map(),key=i=>Math.round(P[i]*400)+','+Math.round(P[i+1]*400)+','+Math.round(P[i+2]*400);
    const out=new Float32Array(P.length);
    for(let i=0;i<P.length;i+=3){
      const k=key(i);let s=m.get(k);if(!s){s=[0,0,0];m.set(k,s)}
      s[0]+=N[i];s[1]+=N[i+1];s[2]+=N[i+2];
    }
    for(let i=0;i<P.length;i+=3){
      const s=m.get(key(i));const l=Math.hypot(s[0],s[1],s[2]);
      if(l<1e-4){out[i]=N[i];out[i+1]=N[i+1];out[i+2]=N[i+2]}else{out[i]=s[0]/l;out[i+1]=s[1]/l;out[i+2]=s[2]/l}
    }
    return out;
  }
  build(gl){
    this.fixWinding();
    const on=this.outlineNormals(),nv=this.p.length/3,data=new Float32Array(nv*14);
    for(let i=0;i<nv;i++){
      const o=i*14;
      data[o]=this.p[i*3];data[o+1]=this.p[i*3+1];data[o+2]=this.p[i*3+2];
      data[o+3]=this.n[i*3];data[o+4]=this.n[i*3+1];data[o+5]=this.n[i*3+2];
      data[o+6]=on[i*3];data[o+7]=on[i*3+1];data[o+8]=on[i*3+2];
      data[o+9]=this.u[i*2];data[o+10]=this.u[i*2+1];
      data[o+11]=this.c[i*3];data[o+12]=this.c[i*3+1];data[o+13]=this.c[i*3+2];
    }
    return new Mesh(gl,data,new Uint32Array(this.idx));
  }
}
class Mesh{
  constructor(gl,data,idx){
    this.gl=gl;this.count=idx.length;this.nv=data.length/14;
    // ELEMENT_ARRAY_BUFFER is part of the *bound VAO's* state. Whichever batch drew last is still bound here, so binding the new index
    // buffer would silently re-point that batch's VAO at it, and deleting this mesh later would leave that VAO with no index buffer
    // (GL_INVALID_OPERATION on every draw: all particles vanish after a few rounds). Always build on the default VAO.
    gl.bindVertexArray(null);
    this.vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    this.ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
  }
  dispose(){this.gl.deleteBuffer(this.vbo);this.gl.deleteBuffer(this.ibo)}
}
const IF=24;                                       // floats per instance
export class Batch{
  constructor(gl,mesh,cap){
    this.gl=gl;this.mesh=mesh;this.cap=cap;this.data=new Float32Array(cap*IF);this.n=0;
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vbo);
    const S=56;
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,S,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,S,12);
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,S,24);
    gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.FLOAT,false,S,36);
    gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,3,gl.FLOAT,false,S,44);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ibo);
    this.ibuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.ibuf);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
    const B=IF*4;
    for(let k=0;k<4;k++){gl.enableVertexAttribArray(5+k);gl.vertexAttribPointer(5+k,4,gl.FLOAT,false,B,k*16);gl.vertexAttribDivisor(5+k,1)}
    gl.enableVertexAttribArray(9);gl.vertexAttribPointer(9,4,gl.FLOAT,false,B,64);gl.vertexAttribDivisor(9,1);
    gl.enableVertexAttribArray(10);gl.vertexAttribPointer(10,4,gl.FLOAT,false,B,80);gl.vertexAttribDivisor(10,1);
    gl.bindVertexArray(null);
  }
  clear(){this.n=0}
  /* reserve an instance slot; returns float offset or -1 when full */
  slot(){if(this.n>=this.cap)return -1;return (this.n++)*IF}
  /* add: TRS + tint + params. col = [r,g,b,emissive], p = [flash,atlas,c0,c1] */
  add(tx,ty,tz,yaw,pitch,roll,sx,sy,sz,r,g,b,emi,flash,atlas,c0,c1){
    const o=this.slot();if(o<0)return;const d=this.data;
    M4.trs(d,o,tx,ty,tz,yaw,pitch,roll,sx,sy,sz);
    d[o+16]=r;d[o+17]=g;d[o+18]=b;d[o+19]=emi||0;d[o+20]=flash||0;d[o+21]=atlas===undefined?-1:atlas;d[o+22]=c0||0;d[o+23]=c1||0;
  }
  addM(m,r,g,b,emi,flash,atlas,c0,c1){            // add with a ready 16-float matrix
    const o=this.slot();if(o<0)return;const d=this.data;
    for(let i=0;i<16;i++)d[o+i]=m[i];
    d[o+16]=r;d[o+17]=g;d[o+18]=b;d[o+19]=emi||0;d[o+20]=flash||0;d[o+21]=atlas===undefined?-1:atlas;d[o+22]=c0||0;d[o+23]=c1||0;
  }
  upload(){
    if(!this.n)return;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.ibuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data,0,this.n*IF);
  }
  draw(){
    if(!this.n)return;const gl=this.gl;gl.bindVertexArray(this.vao);
    gl.drawElementsInstanced(gl.TRIANGLES,this.mesh.count,gl.UNSIGNED_INT,0,this.n);
  }
  dispose(){this.gl.deleteBuffer(this.ibuf);this.gl.deleteVertexArray(this.vao)}
}

/* ------------------------------------------------------------ primitives -- */
export const PR={
  ellipsoid(rx,ry,rz,segs,rings,col){
    const m=new MB(),c=col||[1,1,1];
    for(let j=0;j<=rings;j++){
      const th=j/rings*Math.PI,st=Math.sin(th),ct=Math.cos(th);
      for(let i=0;i<=segs;i++){
        const ph=i/segs*TAU,x=st*Math.cos(ph),z=st*Math.sin(ph),y=ct;
        let nx=x/rx,ny=y/ry,nz=z/rz;const l=Math.hypot(nx,ny,nz)||1;
        m.v(x*rx,y*ry,z*rz,nx/l,ny/l,nz/l,i/segs,j/rings,c[0],c[1],c[2]);
      }
    }
    for(let j=0;j<rings;j++)for(let i=0;i<segs;i++){const a=j*(segs+1)+i,b=a+segs+1;m.quad(a,b,b+1,a+1)}
    return m;
  },
  sphere(r,segs,rings,col){return PR.ellipsoid(r,r,r,segs||14,rings||10,col)},
  box(w,h,d,col){
    const m=new MB(),c=col||[1,1,1],hx=w/2,hy=h/2,hz=d/2;
    const F=[[0,0,1,[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]],[0,0,-1,[hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz]],
      [1,0,0,[hx,-hy,hz],[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz]],[-1,0,0,[-hx,-hy,-hz],[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz]],
      [0,1,0,[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[-hx,hy,-hz]],[0,-1,0,[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz]]];
    for(const f of F){const b=m.verts;for(let k=0;k<4;k++){const p=f[3+k];m.v(p[0],p[1],p[2],f[0],f[1],f[2],k===1||k===2?1:0,k>=2?1:0,c[0],c[1],c[2])}m.quad(b,b+1,b+2,b+3)}
    return m;
  },
  /* surface of revolution. profile = [{r,y,hard,col}] bottom->top. */
  lathe(profile,segs,defCol){
    const m=new MB(),n=profile.length,dc=defCol||[1,1,1];
    const segN=[];                                       // outward normal of each profile segment
    for(let k=0;k<n-1;k++){const dr=profile[k+1].r-profile[k].r,dy=profile[k+1].y-profile[k].y,l=Math.hypot(dr,dy)||1;segN.push([dy/l,-dr/l])}
    const rows=[];                                       // each row = list of {r,y,nr,ny,col}
    for(let k=0;k<n;k++){
      const p=profile[k],col=p.col||dc,a=segN[k-1],b=segN[k];
      if(p.hard&&a&&b){rows.push([{r:p.r,y:p.y,nr:a[0],ny:a[1],col,end:true},{r:p.r,y:p.y,nr:b[0],ny:b[1],col,start:true}])}
      else{
        let nr,ny;if(a&&b){nr=a[0]+b[0];ny=a[1]+b[1]}else{const s=a||b;nr=s[0];ny=s[1]}
        const l=Math.hypot(nr,ny)||1;rows.push([{r:p.r,y:p.y,nr:nr/l,ny:ny/l,col}]);
      }
    }
    const strips=[];                                     // build vertex rings
    for(const row of rows)for(const v of row){
      const base=m.verts;
      for(let i=0;i<=segs;i++){const ph=i/segs*TAU,c=Math.cos(ph),s=Math.sin(ph);m.v(c*v.r,v.y,s*v.r,c*v.nr,v.ny,s*v.nr,i/segs,0,v.col[0],v.col[1],v.col[2])}
      strips.push({base,v});
    }
    // connect consecutive profile points through their end/start rings
    let si=0;const idxOf=[];
    for(const row of rows){idxOf.push(row.map(()=>si++))}
    for(let k=0;k<n-1;k++){
      const A=idxOf[k][idxOf[k].length-1],B=idxOf[k+1][0];
      for(let i=0;i<segs;i++){const a=strips[A].base+i,b=strips[B].base+i;m.quad(a,b,b+1,a+1)}
    }
    return m;
  },
  cyl(rTop,rBot,h,segs,col,capTop,capBot){
    const c=col||[1,1,1];const prof=[];
    if(capBot!==false)prof.push({r:0,y:-h/2,col:c});
    prof.push({r:rBot,y:-h/2,hard:true,col:c},{r:rTop,y:h/2,hard:true,col:c});
    if(capTop!==false)prof.push({r:0,y:h/2,col:c});
    return PR.lathe(prof,segs||14,c);
  },
  cone(r,h,segs,col){const c=col||[1,1,1];return PR.lathe([{r:0,y:0,col:c},{r:r,y:0,hard:true,col:c},{r:0,y:h,col:c}],segs||12,c)},
  torus(R,r,segs,sides,col){
    const m=new MB(),c=col||[1,1,1];
    for(let j=0;j<=sides;j++){
      const th=j/sides*TAU,ct=Math.cos(th),st=Math.sin(th);
      for(let i=0;i<=segs;i++){
        const ph=i/segs*TAU,cp=Math.cos(ph),sp=Math.sin(ph);
        m.v((R+r*ct)*cp,r*st,(R+r*ct)*sp,ct*cp,st,ct*sp,i/segs,j/sides,c[0],c[1],c[2]);
      }
    }
    for(let j=0;j<sides;j++)for(let i=0;i<segs;i++){const a=j*(segs+1)+i,b=a+segs+1;m.quad(a,b,b+1,a+1)}
    return m;
  },
  capsule(r,len,segs,rings,col){                    // along Y, total height len+2r
    const m=new MB(),c=col||[1,1,1],half=len/2;let rows=0;
    const ring=(y,rad,ny,nr,v)=>{for(let i=0;i<=segs;i++){const ph=i/segs*TAU,cp=Math.cos(ph),sp=Math.sin(ph);m.v(cp*rad,y,sp*rad,cp*nr,ny,sp*nr,i/segs,v,c[0],c[1],c[2])}rows++};
    for(let t=0;t<=rings;t++){const a=t/rings*Math.PI/2;ring(half+r*Math.cos(a),r*Math.sin(a),Math.cos(a),Math.sin(a),t/(rings*2+1))}
    for(let t=0;t<=rings;t++){const b=t/rings*Math.PI/2;ring(-half-r*Math.sin(b),r*Math.cos(b),-Math.sin(b),Math.cos(b),(rings+1+t)/(rings*2+1))}
    for(let j=0;j<rows-1;j++)for(let i=0;i<segs;i++){const a=j*(segs+1)+i,b=a+segs+1;m.quad(a,b,b+1,a+1)}
    return m;
  },
  /* extruded annular sector centred on angle 0 (top at y=0), chamfered top edge. */
  sector(rIn,rOut,ang,thick,bevel,topCol,sideCol){
    const m=new MB(),tc=topCol||[1,1,1],sc=sideCol||tc;
    const nArc=Math.max(2,Math.ceil(ang/(Math.PI/10)));
    const loop=(inset)=>{                             // inner arc forward then outer arc backward
      const pts=[];const ri=rIn+inset,ro=rOut-inset;
      for(let i=0;i<=nArc;i++){const a=-ang/2+inset/Math.max(.2,rIn)+i/nArc*(ang-2*inset/Math.max(.2,rIn));pts.push([Math.cos(a)*ri,Math.sin(a)*ri])}
      for(let i=nArc;i>=0;i--){const a=-ang/2+inset/ro+i/nArc*(ang-2*inset/ro);pts.push([Math.cos(a)*ro,Math.sin(a)*ro])}
      return pts;
    };
    const top=loop(bevel),full=loop(0),L=top.length;
    // top face: strip between inner arc point i and outer arc point (L-1-i)
    for(let i=0;i<nArc;i++){
      const ia=top[i],ib=top[i+1],oa=top[L-1-i],ob=top[L-2-i];
      const b=m.verts;
      m.v(ia[0],0,ia[1],0,1,0,0,0,tc[0],tc[1],tc[2]);m.v(ib[0],0,ib[1],0,1,0,1,0,tc[0],tc[1],tc[2]);
      m.v(ob[0],0,ob[1],0,1,0,1,1,tc[0],tc[1],tc[2]);m.v(oa[0],0,oa[1],0,1,0,0,1,tc[0],tc[1],tc[2]);
      m.quad(b,b+1,b+2,b+3);
    }
    const ring=(A,ya,B,yb,col)=>{
      for(let k=0;k<L;k++){
        const k2=(k+1)%L,a0=A[k],a1=A[k2],b0=B[k],b1=B[k2];
        const e1=[a1[0]-a0[0],0,a1[1]-a0[1]],e2=[b0[0]-a0[0],yb-ya,b0[1]-a0[1]];
        let nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0];
        const ox=-e1[2],oz=e1[0];                           // outward horizontal direction for this loop's winding
        if(nx*ox+nz*oz<0){nx=-nx;ny=-ny;nz=-nz}
        const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
        if(Math.hypot(e1[0],e1[2])<1e-6)continue;
        const b=m.verts;
        m.v(a0[0],ya,a0[1],nx,ny,nz,0,0,col[0],col[1],col[2]);m.v(a1[0],ya,a1[1],nx,ny,nz,1,0,col[0],col[1],col[2]);
        m.v(b1[0],yb,b1[1],nx,ny,nz,1,1,col[0],col[1],col[2]);m.v(b0[0],yb,b0[1],nx,ny,nz,0,1,col[0],col[1],col[2]);
        m.quad(b,b+1,b+2,b+3);
      }
    };
    const yc=-bevel*.7;
    ring(top,0,full,yc,[tc[0]*.9,tc[1]*.9,tc[2]*.9]);
    ring(full,yc,full,-thick,sc);
    // underside
    for(let i=0;i<nArc;i++){
      const ia=full[i],ib=full[i+1],oa=full[L-1-i],ob=full[L-2-i],b=m.verts;
      m.v(ia[0],-thick,ia[1],0,-1,0,0,0,sc[0]*.6,sc[1]*.6,sc[2]*.6);m.v(ib[0],-thick,ib[1],0,-1,0,1,0,sc[0]*.6,sc[1]*.6,sc[2]*.6);
      m.v(ob[0],-thick,ob[1],0,-1,0,1,1,sc[0]*.6,sc[1]*.6,sc[2]*.6);m.v(oa[0],-thick,oa[1],0,-1,0,0,1,sc[0]*.6,sc[1]*.6,sc[2]*.6);
      m.quad(b,b+1,b+2,b+3);
    }
    return m;
  },
  /* flat quad in XZ facing up, size 1 (scaled by instance) with 0..1 uv */
  floorQuad(col){const m=new MB(),c=col||[1,1,1];m.v(-.5,0,-.5,0,1,0,0,0,c[0],c[1],c[2]);m.v(.5,0,-.5,0,1,0,1,0,c[0],c[1],c[2]);m.v(.5,0,.5,0,1,0,1,1,c[0],c[1],c[2]);m.v(-.5,0,.5,0,1,0,0,1,c[0],c[1],c[2]);m.quad(0,1,2,3);return m},
  /* patch of a sphere shell (for faces): lon/lat ranges in radians around +Z, uv spans 0..1 */
  facePatch(r,lonHalf,latHalf,segs){
    const m=new MB();
    for(let j=0;j<=segs;j++)for(let i=0;i<=segs;i++){
      const u=i/segs,v=j/segs,lon=(u-.5)*2*lonHalf,lat=(.5-v)*2*latHalf;
      const x=Math.sin(lon)*Math.cos(lat),y=Math.sin(lat),z=Math.cos(lon)*Math.cos(lat);
      m.v(x*r,y*r,z*r,x,y,z,u,v,1,1,1);
    }
    for(let j=0;j<segs;j++)for(let i=0;i<segs;i++){const a=j*(segs+1)+i,b=a+segs+1;m.quad(a,b,b+1,a+1)}
    return m;
  }
};

/* ---------------------------------------------------------------- GL core -- */
export function compileProgram(gl,vs,fs,name){
  const mk=(type,src)=>{
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);throw new Error('shader '+name+' '+(type===gl.VERTEX_SHADER?'VS':'FS')+': '+e)}
    return s;
  };
  const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('link '+name+': '+gl.getProgramInfoLog(p));
  const prog={p,name,loc:{},gl};
  prog.u=function(n){let l=prog.loc[n];if(l===undefined){l=gl.getUniformLocation(p,n);prog.loc[n]=l}return l};
  return prog;
}
export function makeTexture(gl,canvas,opts){
  opts=opts||{};
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
  if(opts.mips!==false){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)}
  else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,opts.repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,opts.repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
  return t;
}
export function hexRGB(h){h=h.replace('#','');return [parseInt(h.substr(0,2),16)/255,parseInt(h.substr(2,2),16)/255,parseInt(h.substr(4,2),16)/255]}
function mixRGB(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}
