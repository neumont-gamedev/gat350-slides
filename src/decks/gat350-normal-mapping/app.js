(() => {
"use strict";
const Y="#ffc20e", BLUE="#6ab8ff", GREEN="#5fd68a", RED="#ff5a4e", AMBER="#ff8a1f", PURPLE="#b18cff", INK="#f3f1ea", MUTE="#9b988f", LINE="#2e2e35";
const stage=document.getElementById("stage");
const slides=[...document.querySelectorAll(".slide")];
const $=id=>document.getElementById(id);
const NS="http://www.w3.org/2000/svg";
const svgEl=(tag,attrs={},parent)=>{ const e=document.createElementNS(NS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; };
const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[(Math.random()*a.length)|0];
const ease=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
// seeded random, so demos look the same every class
function srand(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const gauss=r=>{ let u=0,v=0; while(!u) u=r(); while(!v) v=r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const fmt=(v,d=2)=>{ const s=(+v).toFixed(d); return s.replace(/\.?0+$/,"")||"0"; };
const fx=(v,d=2)=>(v<0?"−":"")+Math.abs(v).toFixed(d);
let cur=-1;

/* ---------- stage + canvas sizing ---------- */
function fitStage(){
  const s=Math.min(innerWidth/1600,innerHeight/900);
  stage.style.transform=`translate(-50%,-50%) scale(${s})`;
  document.querySelectorAll("canvas").forEach(fitCanvas);
}
function fitCanvas(c){
  if(!c.offsetWidth) return;
  const r=c.getBoundingClientRect(), dpr=devicePixelRatio||1;
  const w=Math.max(1,Math.round(r.width*dpr)), h=Math.max(1,Math.round(r.height*dpr));
  if(c.width!==w||c.height!==h){ c.width=w; c.height=h; }
  c._k=c.width/c.offsetWidth;
}
function ctxOf(c){ const x=c.getContext("2d"); x.setTransform(c._k||1,0,0,c._k||1,0,0); return x; }
// pointer position in an element's own (unscaled) pixels
function localXY(e,el){ const r=el.getBoundingClientRect(), k=r.width/el.offsetWidth; return [(e.clientX-r.left)/k,(e.clientY-r.top)/k]; }
function svgXY(e,svg){ const p=svg.createSVGPoint(); p.x=e.clientX; p.y=e.clientY; const q=p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x,q.y]; }
function tabs(el,cb){ el.querySelectorAll("button[data-k]").forEach(b=>b.onclick=()=>{ set(b.dataset.k); cb(b.dataset.k); }); function set(k){ el.querySelectorAll("button[data-k]").forEach(b=>b.classList.toggle("on",b.dataset.k===k)); } return set; }
function toggle(btn,cb){ btn.onclick=()=>{ const on=!btn.classList.contains("on"); btn.classList.toggle("on",on); cb(on); }; return on=>{ btn.classList.toggle("on",on); }; }
function slider(id,fmtf,cb){ const el=$(id), out=$(id+"O"); const upd=()=>{ if(out) out.textContent=fmtf(+el.value); cb&&cb(+el.value); }; el.addEventListener("input",upd); return { get:()=>+el.value, set:v=>{ el.value=v; upd(); } }; }
const A={};

/* shared canvas helpers */
function label(x,t,px,py,col=MUTE,size=14,align="left",font="JetBrains Mono"){ x.fillStyle=col; x.font=`${size}px "${font}",monospace`; x.textAlign=align; x.fillText(t,px,py); x.textAlign="left"; }
function dot(x,px,py,r,fill,stroke){ x.beginPath(); x.arc(px,py,r,0,7); if(fill){ x.fillStyle=fill; x.fill(); } if(stroke){ x.strokeStyle=stroke; x.lineWidth=2; x.stroke(); } }
function img(src){ const im=new Image(); im.decoding="async"; im.src=src; return im; }
function whenLoaded(im,cb){ if(im.complete&&im.naturalWidth) cb(); else im.addEventListener("load",cb,{once:true}); }
function arrowSvg(g,x1,y1,x2,y2,col,w=4,dash){
  const a=Math.atan2(y2-y1,x2-x1), h=16;
  svgEl("line",{x1,y1,x2:x2-Math.cos(a)*h*.6,y2:y2-Math.sin(a)*h*.6,stroke:col,"stroke-width":w,"stroke-linecap":"round","stroke-dasharray":dash||""},g);
  svgEl("path",{d:`M${x2},${y2} L${x2-Math.cos(a-.4)*h},${y2-Math.sin(a-.4)*h} L${x2-Math.cos(a+.4)*h},${y2-Math.sin(a+.4)*h}Z`,fill:col},g);
}
function textSvg(g,t,x,y,col=INK,size=20,anchor="start",weight=500){ const e=svgEl("text",{x,y,fill:col,"font-size":size,"font-family":"JetBrains Mono, monospace","text-anchor":anchor,"font-weight":weight},g); e.textContent=t; return e; }


/* ---------- code listings: highlight + line helpers ---------- */
const KW=new Set("struct return void const if else for while true false cbuffer register in out".split(" "));
const TY=/^(float|float2|float3|float4|float3x3|float4x4|int|uint|bool|Uint32|Texture2D|TextureCube|SamplerState|SDL_[A-Z][A-Za-z]*[a-z][A-Za-z]*|Input|Output)$/;
function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function highlight(src){
  return src.split("\n").map(line=>{
    let out="", m; const re=/(\/\/.*$)|("[^"]*")|(\b\d+(?:\.\d+)?f?\b)|([A-Za-z_][A-Za-z0-9_]*)|([^A-Za-z0-9_"\/]+|\/)/g;
    while((m=re.exec(line))){
      if(m[1]) out+=`<span class="c">${esc(m[1])}</span>`;
      else if(m[2]) out+=`<span class="s">${esc(m[2])}</span>`;
      else if(m[3]) out+=`<span class="nu">${m[3]}</span>`;
      else if(m[4]){ const w=m[4], next=line.slice(re.lastIndex).trimStart()[0];
        if(KW.has(w)) out+=`<span class="kw">${w}</span>`;
        else if(/^(SV_\w+|TEXCOORD\d)$/.test(w)) out+=`<span class="sem">${w}</span>`;
        else if(/^SDL_[A-Z0-9_]+$/.test(w)) out+=`<span class="k2">${w}</span>`;
        else if(TY.test(w)) out+=`<span class="ty">${w}</span>`;
        else if(next==="(") out+=`<span class="fn">${w}</span>`;
        else out+=w; }
      else out+=esc(m[5]);
    }
    return `<span class="ln">${out||" "}</span>`;
  }).join("");
}
function setCode(pre,src){ pre.innerHTML=highlight(src); pre._lines=[...pre.querySelectorAll(".ln")]; }
document.querySelectorAll("pre.src[data-code]").forEach(p=>setCode(p,$(p.dataset.code).textContent));
// highlight line ranges [[a,b],...] (1-based); empty = no dimming
function hlLines(pre,ranges){
  pre.classList.toggle("dim",ranges.length>0);
  pre._lines.forEach((l,i)=>l.classList.toggle("hl",ranges.some(([a,b])=>i+1>=a&&i+1<=b)));
}
// hover a line to explain it: tips = [[a,b,html],...], the smallest matching range wins
function codeTips(pre,tipEl,tips,idle){
  tipEl.innerHTML=idle;
  pre._lines.forEach((l,i)=>{
    const n=i+1, cands=tips.filter(t=>n>=t[0]&&n<=t[1]).sort((p,q)=>(p[1]-p[0])-(q[1]-q[0]));
    if(!cands.length) return;
    l.classList.add("hov");
    l.addEventListener("mouseenter",()=>{ const t=cands[0]; hlLines(pre,[[t[0],t[1]]]); tipEl.innerHTML=t[2]; });
  });
  pre.addEventListener("mouseleave",()=>{ hlLines(pre,[]); tipEl.innerHTML=idle; });
}

/* ---------- tiny mat4 / vec3 library (column-major, like glm) ---------- */
const V3={ sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], norm:a=>{ const l=Math.hypot(...a)||1; return a.map(v=>v/l); } };
const M4={
  id:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
  mul(a,b){ const o=new Float32Array(16); for(let c=0;c<4;c++) for(let r=0;r<4;r++){ let s=0; for(let k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k]; o[c*4+r]=s; } return o; },
  persp(fy,asp,n,f){ const t=1/Math.tan(fy/2), o=new Float32Array(16); o[0]=t/asp; o[5]=t; o[10]=(f+n)/(n-f); o[11]=-1; o[14]=2*f*n/(n-f); return o; },
  lookAt(e,c,up){ const z=V3.norm(V3.sub(e,c)), x=V3.norm(V3.cross(up,z)), y=V3.cross(z,x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -V3.dot(x,e),-V3.dot(y,e),-V3.dot(z,e),1]); },
  T(x,y,z){ const o=M4.id(); o[12]=x; o[13]=y; o[14]=z; return o; },
  S(x,y=x,z=x){ const o=M4.id(); o[0]=x; o[5]=y; o[10]=z; return o; },
  RX(a){ const c=Math.cos(a), s=Math.sin(a), o=M4.id(); o[5]=c; o[6]=s; o[9]=-s; o[10]=c; return o; },
  RY(a){ const c=Math.cos(a), s=Math.sin(a), o=M4.id(); o[0]=c; o[2]=-s; o[8]=s; o[10]=c; return o; },
  rotOnly(m){ const o=new Float32Array(m); o[12]=o[13]=o[14]=0; return o; },   // like (float3x3)View
  chain:(...ms)=>ms.reduce((a,b)=>M4.mul(a,b))
};

M4.apply=(m,v)=>{ const o=[0,0,0,0]; for(let r=0;r<4;r++) o[r]=m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]; return o; };
// project a world point to CSS pixels of a w×h view
function toScreen(VP,p,w,h){ const c=M4.apply(VP,[p[0],p[1],p[2],1]); return [(c[0]/c[3]*.5+.5)*w,(.5-c[1]/c[3]*.5)*h,c[3]]; }
function arrow2d(x,x1,y1,x2,y2,col,w=3,head=12){ const a=Math.atan2(y2-y1,x2-x1); x.strokeStyle=col; x.fillStyle=col; x.lineWidth=w; x.lineCap="round";
  x.beginPath(); x.moveTo(x1,y1); x.lineTo(x2-Math.cos(a)*head*.6,y2-Math.sin(a)*head*.6); x.stroke();
  x.beginPath(); x.moveTo(x2,y2); x.lineTo(x2-Math.cos(a-.4)*head,y2-Math.sin(a-.4)*head); x.lineTo(x2-Math.cos(a+.4)*head,y2-Math.sin(a+.4)*head); x.closePath(); x.fill(); }

/* ---------- images ----------
   the source map is OpenGL-style (Y+: green = up the image). SDL3 GPU puts UV (0,0) at the top-left, so +V and the
   bitangent point DOWN the image. We flip green once on load to get a DirectX-style (Y−) map that matches. */
const IM={ alb:img("{{IMG:stones-albedo.jpg}}"), nrm:img("{{IMG:stones-normal.jpg}}") };
const NRM={canvas:null,data:null,size:512,ready:false};
whenLoaded(IM.nrm,()=>{ const s=NRM.size, c=document.createElement("canvas"); c.width=c.height=s; const x=c.getContext("2d"); x.drawImage(IM.nrm,0,0,s,s);
  const d=x.getImageData(0,0,s,s), p=d.data; for(let i=0;i<p.length;i+=4) p[i+1]=255-p[i+1]; x.putImageData(d,0,0);
  NRM.canvas=c; NRM.data=p; NRM.ready=true; });
function gridCanvas(){ const s=512, c=document.createElement("canvas"); c.width=c.height=s; const x=c.getContext("2d"), d=x.createImageData(s,s);
  for(let j=0;j<s;j++) for(let i=0;i<s;i++){ const k=(j*s+i)*4, line=(i%64<3||j%64<3)?1:0; d.data[k]=40+i/s*215; d.data[k+1]=40+j/s*215; d.data[k+2]=55; if(line){ d.data[k]=d.data[k+1]=d.data[k+2]=30; } d.data[k+3]=255; }
  x.putImageData(d,0,0); return c; }

/* ---------- one shared WebGL2 context, copied into each demo's 2D canvas ---------- */
const GL=(()=>{
  const cv=document.createElement("canvas");
  const gl=cv.getContext("webgl2",{antialias:true,preserveDrawingBuffer:true,alpha:false});
  if(!gl){ console.warn("WebGL2 not available"); return null; }
  const AN=gl.getExtension("EXT_texture_filter_anisotropic");
  const SETTER={[gl.FLOAT]:"uniform1f",[gl.FLOAT_VEC2]:"uniform2fv",[gl.FLOAT_VEC3]:"uniform3fv",[gl.FLOAT_VEC4]:"uniform4fv",[gl.INT]:"uniform1i",[gl.BOOL]:"uniform1i",[gl.SAMPLER_2D]:"uniform1i"};
  function program(vs,fs){
    const p=gl.createProgram();
    for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){ const sh=gl.createShader(t); gl.shaderSource(sh,"#version 300 es\nprecision highp float;\n"+s); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p,sh); }
    gl.bindAttribLocation(p,0,"aPos"); gl.bindAttribLocation(p,1,"aUV"); gl.bindAttribLocation(p,2,"aNrm"); gl.bindAttribLocation(p,3,"aTan");
    gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U={}; for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){ const a=gl.getActiveUniform(p,i); U[a.name]={loc:gl.getUniformLocation(p,a.name),type:a.type}; }
    return {p,U};
  }
  function use(pr,u){ gl.useProgram(pr.p); for(const k in u){ const e=pr.U[k]; if(!e) continue; const v=u[k];
    if(e.type===gl.FLOAT_MAT4) gl.uniformMatrix4fv(e.loc,false,v); else gl[SETTER[e.type]](e.loc,typeof v==="boolean"?+v:v); } }
  function mesh(d){
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    [[0,d.pos,3],[1,d.uv,2],[2,d.nrm,3],[3,d.tan,4]].forEach(([loc,arr,n])=>{ if(!arr) return; const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,n,gl.FLOAT,false,0,0); });
    const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(d.idx),gl.STATIC_DRAW);
    gl.bindVertexArray(null); return {vao,count:d.idx.length};
  }
  function draw(m){ gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0); }
  function sampler(){ const s=gl.createSampler();
    gl.samplerParameteri(s,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.samplerParameteri(s,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.samplerParameteri(s,p,gl.REPEAT);
    if(AN) gl.samplerParameterf(s,AN.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(AN.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return s; }
  function blankTex(rgba){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(rgba)); return t; }
  // RGBA8: a linear (UNORM) format, like SDL_GPU_TEXTUREFORMAT_R8G8B8A8_UNORM
  function texFrom(source){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source); gl.generateMipmap(gl.TEXTURE_2D); return t; }
  function bind(unit,t,s){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,t); gl.bindSampler(unit,s||null); }
  function render(target,fn){
    fitCanvas(target); const w=target.width, h=target.height; if(w<2||h<2) return;
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
    gl.viewport(0,0,w,h); gl.clearColor(.051,.051,.059,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    fn(w,h);
    const x=target.getContext("2d"); x.setTransform(1,0,0,1,0,0); x.drawImage(cv,0,0);
  }
  return {gl,program,use,mesh,draw,sampler,blankTex,texFrom,bind,render};
})();

/* ---------- meshes (with tangents computed from UV deltas, like a model importer does) ---------- */
function withTangents(d){
  const n=d.pos.length/3, ta=new Float32Array(n*3), ba=new Float32Array(n*3);
  const P=i=>[d.pos[i*3],d.pos[i*3+1],d.pos[i*3+2]];
  for(let k=0;k<d.idx.length;k+=3){ const i0=d.idx[k], i1=d.idx[k+1], i2=d.idx[k+2];
    const e1=V3.sub(P(i1),P(i0)), e2=V3.sub(P(i2),P(i0));
    const du1=d.uv[i1*2]-d.uv[i0*2], dv1=d.uv[i1*2+1]-d.uv[i0*2+1], du2=d.uv[i2*2]-d.uv[i0*2], dv2=d.uv[i2*2+1]-d.uv[i0*2+1];
    const det=du1*dv2-du2*dv1; if(Math.abs(det)<1e-12) continue; const r=1/det;
    for(const i of [i0,i1,i2]) for(let q=0;q<3;q++){ ta[i*3+q]+=(e1[q]*dv2-e2[q]*dv1)*r; ba[i*3+q]+=(e2[q]*du1-e1[q]*du2)*r; } }
  d.tan=[];
  for(let i=0;i<n;i++){ const N=[d.nrm[i*3],d.nrm[i*3+1],d.nrm[i*3+2]]; let T=[ta[i*3],ta[i*3+1],ta[i*3+2]];
    T=V3.sub(T,N.map(v=>v*V3.dot(N,T))); if(Math.hypot(...T)<1e-6) T=Math.abs(N[0])<.9?V3.cross([0,1,0],N):[0,0,1];
    T=V3.norm(T); const w=V3.dot(V3.cross(N,T),[ba[i*3],ba[i*3+1],ba[i*3+2]])<0?-1:1; d.tan.push(...T,w); }
  return d; }
function quadData(){ return {pos:[-1,1,0, 1,1,0, 1,-1,0, -1,-1,0], uv:[0,0, 1,0, 1,1, 0,1], nrm:[0,0,1,0,0,1,0,0,1,0,0,1], idx:[0,1,2,0,2,3]}; }
function sphereData(R=1,la=48,lo=96){
  const pos=[],uv=[],nrm=[],idx=[];
  for(let i=0;i<=la;i++){ const th=i/la*Math.PI; for(let j=0;j<=lo;j++){ const ph=j/lo*Math.PI*2; const n=[Math.sin(th)*Math.sin(ph),Math.cos(th),Math.sin(th)*Math.cos(ph)];
    pos.push(...n.map(v=>v*R)); nrm.push(...n); uv.push(j/lo,i/la); } }
  for(let i=0;i<la;i++) for(let j=0;j<lo;j++){ const a=i*(lo+1)+j, b=a+lo+1; idx.push(a,b,a+1,a+1,b,b+1); }
  return {pos,uv,nrm,idx,la,lo};
}
const DATA={quad:withTangents(quadData()), sphere:withTangents(sphereData())};
const MESH={}, TX={}, SM={}, P={};
const SRC={
  litV:`in vec3 aPos; in vec2 aUV; in vec3 aNrm; in vec4 aTan; uniform mat4 uModel, uVP; uniform vec2 uTiling; out vec3 vW, vN, vT, vB; out vec2 vUV;
    void main(){ vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; mat3 m=mat3(uModel);
      vec3 N=normalize(m*aNrm), T=normalize(m*aTan.xyz); T=normalize(T-N*dot(T,N));
      vN=N; vT=T; vB=cross(N,T)*aTan.w; vUV=aUV*uTiling; gl_Position=uVP*w; }`,
  litF:`in vec3 vW, vN, vT, vB; in vec2 vUV; uniform sampler2D uAlb, uNrm; uniform int uUseAlb, uUseNrm, uBug, uShow;
    uniform vec3 uLight, uCam; uniform float uAmb; out vec4 o;
    void main(){ vec3 Ng=normalize(vN), T=normalize(vT), B=normalize(vB);
      vec3 c=texture(uNrm,vUV).rgb;
      if(uBug==1) c.g=1.-c.g;                 // a Y+ (OpenGL-style) map
      if(uBug==2) c=pow(c,vec3(2.2));          // sampled through an sRGB format
      vec3 n = uBug==3 ? c : c*2.-1.;          // forgot to decode
      vec3 N=Ng; if(uUseNrm==1) N = uBug==4 ? normalize(n) : normalize(mat3(T,B,Ng)*n);
      if(uShow==1){ o=vec4(N*.5+.5,1.); return; }
      vec3 alb=uUseAlb==1?texture(uAlb,vUV).rgb:vec3(.78);
      vec3 L=normalize(uLight-vW), V=normalize(uCam-vW), H=normalize(L+V);
      float d=max(dot(N,L),0.), s=pow(max(dot(N,H),0.),48.)*.3*step(0.,dot(Ng,L));
      o=vec4(alb*(uAmb+d*.95)+vec3(s),1.); }`
};
if(GL){
  try{
    P.lit=GL.program(SRC.litV,SRC.litF);
    for(const k in DATA) MESH[k]=GL.mesh(DATA[k]);
    SM.mip=GL.sampler();
    TX.alb={t:GL.blankTex([128,128,128,255])}; TX.nrm={t:GL.blankTex([128,128,255,255])}; TX.grid={t:GL.texFrom(gridCanvas())};
    whenLoaded(IM.alb,()=>{ TX.alb.t=GL.texFrom(IM.alb); });
    whenLoaded(IM.nrm,()=>{ TX.nrm.t=GL.texFrom(NRM.canvas); });
  }catch(e){ console.error(e); }
}
function noGL(cv,msg="This demo needs WebGL2."){ const x=ctxOf(cv); x.fillStyle="#0d0d0f"; x.fillRect(0,0,cv.offsetWidth,cv.offsetHeight); label(x,msg,cv.offsetWidth/2,cv.offsetHeight/2,MUTE,18,"center"); }
function orbit(el,st,{minP=-1.2,maxP=1.2,k=.008}={}){
  let last=null;
  el.addEventListener("pointerdown",e=>{ last=[e.clientX,e.clientY]; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove",e=>{ if(!last) return; st.yaw+=(e.clientX-last[0])*k; st.pitch=clamp(st.pitch+(e.clientY-last[1])*k,minP,maxP); last=[e.clientX,e.clientY]; st.moved=true; });
  el.addEventListener("pointerup",()=>last=null); el.addEventListener("pointercancel",()=>last=null);
  return st;
}
// draw one lit, normal-mapped mesh; returns the view-projection matrix (for overlays)
function litScene(cv,o){
  if(!GL||!P.lit){ noGL(cv); return null; }
  const {mesh,model=M4.id(),eye=[0,0,3.2],target=[0,0,0],light=[1,1,2],tiling=[1,1],alb=1,nrm=1,bug=0,show=0,amb=.12,fov=.9,albTex="alb"}=o;
  let VP=null;
  GL.render(cv,(w,h)=>{ VP=M4.mul(M4.persp(fov,w/h,.05,100),M4.lookAt(eye,target,[0,1,0]));
    GL.bind(0,TX[albTex].t,SM.mip); GL.bind(1,TX.nrm.t,SM.mip);
    GL.use(P.lit,{uModel:model,uVP:VP,uTiling:tiling,uAlb:0,uNrm:1,uUseAlb:alb,uUseNrm:nrm,uBug:bug,uShow:show,uLight:light,uCam:eye,uAmb:amb}); GL.draw(MESH[mesh]); });
  return VP;
}
function eyeOf(st,R){ return [Math.sin(st.yaw)*Math.cos(st.pitch)*R,-Math.sin(st.pitch)*R,Math.cos(st.yaw)*Math.cos(st.pitch)*R]; }
function lightDot(cv,VP,p,col=Y){ if(!VP) return; const x=ctxOf(cv), [sx,sy,w]=toScreen(VP,p,cv.offsetWidth,cv.offsetHeight); if(w<=0) return;
  const g=x.createRadialGradient(sx,sy,0,sx,sy,26); g.addColorStop(0,"rgba(255,194,14,.9)"); g.addColorStop(1,"rgba(255,194,14,0)"); x.fillStyle=g; x.beginPath(); x.arc(sx,sy,26,0,7); x.fill(); dot(x,sx,sy,6,col); }
// the "seen from above" glyph for a tangent-space normal
function normalGlyph(cv,n){ fitCanvas(cv); const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight, cx=W/2, cy=H/2, R=Math.min(W,H)/2-18;
  x.clearRect(0,0,W,H); x.strokeStyle=LINE; x.lineWidth=2; x.beginPath(); x.arc(cx,cy,R,0,7); x.stroke();
  x.setLineDash([4,5]); x.beginPath(); x.moveTo(cx-R,cy); x.lineTo(cx+R,cy); x.moveTo(cx,cy-R); x.lineTo(cx,cy+R); x.stroke(); x.setLineDash([]);
  label(x,"+x",cx+R-4,cy-6,RED,12,"right"); label(x,"+y",cx+6,cy+R-4,GREEN,12);
  if(!n) return; const tx=cx+n[0]*R, ty=cy+n[1]*R;
  dot(x,cx,cy,5+Math.max(0,n[2])*6,"rgba(106,184,255,.55)");
  if(Math.hypot(n[0],n[1])>.03) arrow2d(x,cx,cy,tx,ty,Y,3,11); else dot(x,cx,cy,5,Y); }
const f2=v=>fx(v,2);

/* ---------- title + recap: a stone wall under a wandering light ---------- */
function wallBg(id,speed){ const cv=$(id); let t0=0;
  return { enter(){ t0=performance.now(); },
    tick(dt,now){ const t=(now-t0)/1000*speed, L=[Math.sin(t*.7)*1.7,Math.cos(t*.53)*.8,.55];
      litScene(cv,{mesh:"quad",model:M4.S(2,2,1),eye:[0,0,2.1],light:L,tiling:[2,2],amb:.06}); } }; }
A.title=wallBg("tiBg",1); A.recap=wallBg("rcBg",.8);
$("rcChips").innerHTML=["normal map","RGB → XYZ","n = c · 2 − 1","per-pixel normals","baking","height map","tangent space","tangent","bitangent","TBN matrix","orthonormal","inverse = transpose","mul(n, TBN)","world vs tangent space","Y− (DirectX-style) maps","UNORM, not sRGB"]
  .map(t=>`<span class="tag t-y">${t}</span>`).join("");

/* ---------- what: two triangles, toggle the map, light follows the mouse ---------- */
A.what=(()=>{ const cv=$("whCv"); let nrm=1, alb=1, mouse=null, t=0;
  $("whNrm").onclick=()=>{ nrm^=1; $("whNrm").classList.toggle("on",!!nrm); $("whNrm").textContent="normal map: "+(nrm?"on":"off"); };
  $("whAlb").onclick=()=>{ alb^=1; $("whAlb").classList.toggle("on",!!alb); $("whAlb").textContent="albedo: "+(alb?"on":"off"); };
  $("whAlb").classList.add("on");
  cv.addEventListener("pointermove",e=>{ const [mx,my]=localXY(e,cv); mouse=[(mx/cv.offsetWidth*2-1)*1.3,(1-my/cv.offsetHeight*2)*1.3]; });
  cv.addEventListener("pointerleave",()=>mouse=null);
  return { tick(dt){ t+=dt/1000; const L=mouse?[mouse[0],mouse[1],.6]:[Math.sin(t*.8)*1.1,Math.cos(t*.6)*.8,.6];
    const VP=litScene(cv,{mesh:"quad",model:M4.S(1.15),eye:[0,0,3],light:L,nrm,alb,amb:.08}); lightDot(cv,VP,L);
    $("whCap").textContent=`2 triangles · normal map ${nrm?"on":"off"}`; } }; })();

/* ---------- map: hover a texel, read its direction ---------- */
A.map=(()=>{ const cv=$("mpCv"); let hov=null;
  cv.addEventListener("pointermove",e=>{ const [mx,my]=localXY(e,cv); hov=[mx/cv.offsetWidth,my/cv.offsetHeight]; });
  cv.addEventListener("pointerleave",()=>hov=null);
  function show(c){ const n0=c.map(v=>v/255*2-1), n=V3.norm(n0);
    $("mpRead").innerHTML=`<span class="k">color (0–255)</span><span class="cR">${c[0]}</span>, <span class="cG">${c[1]}</span>, <span class="cB">${c[2]}</span><br>
      <span class="k" style="margin-top:8px">normal = color / 255 * 2 − 1</span>(<span class="cR">${f2(n0[0])}</span>, <span class="cG">${f2(n0[1])}</span>, <span class="cB">${f2(n0[2])}</span>)`;
    $("mpSw").style.background=`rgb(${c})`; normalGlyph($("mpArrow"),n); }
  return { enter(){ show([128,128,255]); },
    tick(){ const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight; x.fillStyle="#0d0d0f"; x.fillRect(0,0,W,H);
      if(!NRM.ready){ label(x,"loading…",W/2,H/2,MUTE,16,"center"); return; }
      x.imageSmoothingEnabled=true; x.drawImage(NRM.canvas,0,0,W,H);
      if(!hov) return;
      const s=NRM.size, i=clamp(Math.floor(hov[0]*s),0,s-1), j=clamp(Math.floor(hov[1]*s),0,s-1), k=(j*s+i)*4, c=[NRM.data[k],NRM.data[k+1],NRM.data[k+2]];
      show(c); const px=hov[0]*W, py=hov[1]*H;
      x.strokeStyle=Y; x.lineWidth=2; x.strokeRect(px-9,py-9,18,18);
      const n=V3.norm(c.map(v=>v/255*2-1)); arrow2d(x,px,py,px+n[0]*90,py+n[1]*90,Y,3,12); } }; })();

/* ---------- decode: sliders → vector ---------- */
A.decode=(()=>{ const cv=$("dcLine"); const col=[0,0,0];
  const sl=["dcR","dcG","dcB"].map((id,i)=>slider(id,v=>v,v=>{ col[i]=v; upd(); }));
  const PRE={flat:[128,128,255],right:[218,128,218],down:[128,218,218],bad:[255,255,128]};
  tabs($("dcPre"),k=>PRE[k].forEach((v,i)=>sl[i].set(v)));
  function upd(){ const c01=col.map(v=>v/255), n=c01.map(v=>v*2-1), len=Math.hypot(...n), nn=V3.norm(n);
    $("dcRead").innerHTML=`<span class="k">color / 255</span>(<span class="cR">${f2(c01[0])}</span>, <span class="cG">${f2(c01[1])}</span>, <span class="cB">${f2(c01[2])}</span>)
      <span class="k" style="margin-top:8px">* 2 − 1</span>(<span class="cR">${f2(n[0])}</span>, <span class="cG">${f2(n[1])}</span>, <span class="cB">${f2(n[2])}</span>)
      <span class="k" style="margin-top:8px">length</span><b style="color:${Math.abs(len-1)<.05?GREEN:RED}">${len.toFixed(2)}</b> ${Math.abs(len-1)<.05?"":"<span class='muted'>→ normalize()</span>"}`;
    normalGlyph($("dcArrow"),nn); draw(); }
  function draw(){ fitCanvas(cv); const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight, l=70, r=W-50; x.fillStyle="#0d0d0f"; x.fillRect(0,0,W,H);
    const yt=70, yb=H-70; [[yt,"color","0","0.5","1"],[yb,"normal","−1","0","1"]].forEach(([y,nm,a,b,c])=>{
      x.strokeStyle=MUTE; x.lineWidth=2; x.beginPath(); x.moveTo(l,y); x.lineTo(r,y); x.stroke();
      [[l,a],[(l+r)/2,b],[r,c]].forEach(([px,t])=>{ x.beginPath(); x.moveTo(px,y-8); x.lineTo(px,y+8); x.stroke(); label(x,t,px,y+(y===yt?-16:30),MUTE,15,"center"); });
      label(x,nm,l-14,y+5,INK,15,"right"); });
    [RED,GREEN,BLUE].forEach((c,i)=>{ const u=col[i]/255, px=l+u*(r-l), py1=yt+12+i*4, py2=yb-12-(2-i)*4;
      x.strokeStyle=c; x.globalAlpha=.6; x.setLineDash([5,5]); x.beginPath(); x.moveTo(px,yt); x.lineTo(px,yb); x.stroke(); x.setLineDash([]); x.globalAlpha=1;
      dot(x,px,yt,8,c); dot(x,px,yb,8,c); const lt="rgb"[i]+" "+(u*2-1).toFixed(2); label(x,lt,u>.8?px-12:px+12,yt+32+i*44,c,15,u>.8?"right":"left"); }); }
  return { enter(){ draw(); } , init(){ sl.forEach((s,i)=>s.set(PRE.flat[i])); } }; })();
A.decode.init();

/* ---------- vertex normals vs map normals: a 2D cross-section ---------- */
A.pernormal=(()=>{ const cv=$("pnCv"); let ang=-40;
  slider("pnL",v=>v+"°",v=>{ ang=v; }).set(-40);
  const r=srand(7);
  const W6=[[.018,10],[.041,6],[.07,3],[.011,7]].map(([f,a])=>({f,a,p:r()*6.28}));
  const h=x=>W6.reduce((s,w)=>s+w.a*Math.sin(x*w.f+w.p),0), dh=x=>W6.reduce((s,w)=>s+w.a*w.f*Math.cos(x*w.f+w.p),0);
  function row(x,y0,title,perPixel,W,L){ const l=60, rr=W-60;
    label(x,title,l,y0-90,INK,17);
    x.setLineDash([5,6]); x.strokeStyle="rgba(155,152,143,.55)"; x.lineWidth=2; x.beginPath(); for(let px=l;px<=rr;px+=3){ const yy=y0-h(px); px===l?x.moveTo(px,yy):x.lineTo(px,yy); } x.stroke(); x.setLineDash([]);
    x.strokeStyle=INK; x.lineWidth=3; x.beginPath(); x.moveTo(l,y0); x.lineTo(rr,y0); x.stroke();
    // shading strip
    for(let px=l;px<rr;px+=2){ const n=perPixel?V3.norm([-dh(px),1,0]):[0,1,0], d=Math.max(0,n[0]*L[0]+n[1]*L[1]), v=Math.round(25+d*215);
      x.fillStyle=`rgb(${v},${v},${Math.round(v*.95)})`; x.fillRect(px,y0+18,3,34); }
    
    if(!perPixel){ [l,(l+rr)/2,rr].forEach(px=>{ dot(x,px,y0,6,Y); arrow2d(x,px,y0,px,y0-62,BLUE,3,11); }); label(x,"one normal per vertex, all the same → same brightness everywhere",l,y0+80,MUTE,15); }
    else { for(let px=l+10;px<rr;px+=34){ const n=V3.norm([-dh(px),1,0]); arrow2d(x,px,y0,px+n[0]*48,y0-n[1]*48,BLUE,2,9); } label(x,"a normal from the map at every pixel → bumps in the lighting",l,y0+80,MUTE,15); } }
  return { tick(){ const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight; x.fillStyle="#0d0d0f"; x.fillRect(0,0,W,H);
    const a=ang*Math.PI/180, L=[Math.sin(a),Math.cos(a)];
    row(x,180,"VERTEX NORMALS · one flat triangle",false,W,L); row(x,425,"MAP NORMALS · same triangle + normal map",true,W,L);
    // directional light: place the marker in the direction it shines from, relative to the middle of the rows,
    // so a light from the left is drawn on the left (not always near the right edge)
    const sx=W/2+L[0]*(W/2-90), sy=20+(1-L[1])*12; dot(x,sx,sy,10,Y); arrow2d(x,sx,sy,sx-L[0]*28,sy+L[1]*28,Y,3,9);
    label(x,"light",L[0]>0?sx-16:sx+16,sy+5,Y,14,L[0]>0?"right":"left"); } }; })();

/* ---------- layers: albedo, normal, N-as-color ---------- */
A.layers=(()=>{ const cv=$("lyCv"), st=orbit(cv,{yaw:0,pitch:-.15}); const on={alb:1,nrm:1,show:0}; let t=0;
  $("lyFigs").querySelectorAll("figure").forEach(f=>f.onclick=()=>{ const k=f.dataset.k; on[k]^=1; sync(); });
  function sync(){ $("lyFigs").querySelectorAll("figure").forEach(f=>{ const k=f.dataset.k; f.classList.toggle("on",!!on[k]); f.classList.toggle("off",!on[k]); });
    $("lyCap").textContent=on.show?"showing N as color":(on.alb&&on.nrm?"final: albedo × lighting with map normals":on.alb?"albedo, vertex normals":on.nrm?"normal map only, gray albedo":"no maps"); }
  function thumbs(){ if(!NRM.ready) return; [["lyNrm",0],["lyShow",1]].forEach(([id,k])=>{ const c=$(id); fitCanvas(c); const x=ctxOf(c), W=c.offsetWidth, H=c.offsetHeight;
    x.drawImage(NRM.canvas,0,0,W,H); if(k){ x.fillStyle="rgba(13,13,15,.55)"; x.fillRect(0,0,W,H); label(x,"N · 0.5 + 0.5",W/2,H/2+5,INK,15,"center"); } }); }
  return { enter(){ sync(); thumbs(); },
    tick(dt){ t+=dt/1000; if(!st.moved) st.yaw+=dt*.00015; const eye=eyeOf(st,3.1), L=[Math.cos(t*.7)*2.4,1.2,Math.sin(t*.7)*2.4];
      const VP=litScene(cv,{mesh:"sphere",eye,light:L,tiling:[3,1.5],alb:on.alb,nrm:on.nrm,show:on.show}); lightDot(cv,VP,L); } }; })();

/* ---------- why tangent space ---------- */
A.why=(()=>{ const cv=$("wyCv"), st=orbit(cv,{yaw:0,pitch:0},{minP:-.8,maxP:.8}); let mode="raw", show=0, blend=0;   // start looking down world -Z, so +Z is out of the screen
  const TIP={raw:`<span class="k">map normal used as a world normal</span>A flat spot in the map is <b>(0, 0, 1)</b>, so every arrow points the same way, at <b>world +Z</b> (out of the screen until you turn the model), wherever the surface faces. Only the middle looks right, and the bumps light up from the wrong side.`,
    tbn:`<span class="k">rotated by the TBN matrix</span>Each pixel’s map normal is rotated to follow <b>its own</b> surface. The same <b>(0, 0, 1)</b> now points straight out of the sphere, so the whole model lights correctly.`};
  const setM=tabs($("wyMode"),k=>{ mode=k; $("wyTip").innerHTML=TIP[k]; }); setM("raw"); $("wyTip").innerHTML=TIP.raw;
  toggle($("wyShow"),v=>show=+v);
  // sample points for the normal arrows (spread over the sphere)
  const d=DATA.sphere, S=[], g=(a,k,n)=>a.slice(k*n,k*n+3);
  for(let i=6;i<=d.la-6;i+=6){ const step=Math.max(6,Math.round(8/Math.sin(i/d.la*Math.PI))); for(let j=(i/6%2)*step/2|0;j<d.lo;j+=step) S.push(i*(d.lo+1)+j); }
  return { tick(dt){ const eye=eyeOf(st,3.4), L=[2.6,1.3,1.2];
    blend+=((mode==="tbn"?1:0)-blend)*Math.min(1,(dt||16)/140);   // ease the arrows between the two answers
    const VP=litScene(cv,{mesh:"sphere",eye,light:L,tiling:[3,1.5],bug:mode==="raw"?4:0,show}); lightDot(cv,VP,L);
    // camera axes: arrows are drawn without perspective so parallel normals stay parallel on screen
    const vz=V3.norm(eye), vx=V3.norm(V3.cross([0,1,0],vz)), vy=V3.cross(vz,vx);
    $("wyCap").textContent=mode==="raw"?"N = normalize(n)   ✗":"N = normalize(mul(n, TBN))   ✓";
    if(!VP) return; const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight, s=.3, c0=toScreen(VP,[0,0,0],W,H), c1=toScreen(VP,vx,W,H), px=Math.hypot(c1[0]-c0[0],c1[1]-c0[1])*s;
    S.forEach(k=>{ const p=g(d.pos,k,3), Ns=g(d.nrm,k,3); if(V3.dot(Ns,V3.sub(eye,p))<.12) return;   // front of the sphere only
      // map normal (0,0,1): as-is it is world +Z; through TBN it becomes the surface normal
      const n=V3.norm([Ns[0]*blend,Ns[1]*blend,Ns[2]*blend+(1-blend)]);
      const o=toScreen(VP,p,W,H), q=[o[0]+V3.dot(n,vx)*px,o[1]-V3.dot(n,vy)*px];
      const at=Math.max(0,(V3.dot(n,vz)-.75)/.25);   // ⊙ = pointing at you
      if(at>0){ x.globalAlpha=at; x.strokeStyle=BLUE; x.lineWidth=2; x.beginPath(); x.arc(o[0],o[1],8,0,6.284); x.stroke(); x.globalAlpha=1; }
      dot(x,o[0],o[1],3,Y); if(Math.hypot(q[0]-o[0],q[1]-o[1])>9) arrow2d(x,o[0],o[1],q[0],q[1],BLUE,2.5,9); }); } }; })();

/* ---------- frame: T B N at vertices ---------- */
A.frame=(()=>{ const cv=$("frCv"), st=orbit(cv,{yaw:.5,pitch:-.35}); let mouse=null, pick=null;
  cv.addEventListener("pointermove",e=>{ mouse=localXY(e,cv); }); cv.addEventListener("pointerleave",()=>mouse=null);
  const d=DATA.sphere, S=[]; for(let i=4;i<=d.la-4;i+=4) for(let j=0;j<d.lo;j+=8){ const k=i*(d.lo+1)+j; S.push(k); }
  const g=(a,k,n)=>a.slice(k*n,k*n+3);
  function show(k){ if(k==null){ const dash="<span class=\"muted\">(  —  ,   —  ,   —  )</span>";   // same 4 lines as the hover readout, so the box never resizes
    $("frRead").innerHTML=`<span class="k">vertex · <span class="muted">hover a vertex</span></span><span class="cR">T</span> ${dash}<br><span class="cG">B</span> ${dash}<br><span class="cB">N</span> ${dash}`; return; }
    const T=g(d.tan,k,4), N=g(d.nrm,k,3), B=V3.cross(N,T).map(v=>v*d.tan[k*4+3]), uv=[d.uv[k*2],d.uv[k*2+1]];
    const v=a=>`(${a.map(f2).join(", ")})`;
    $("frRead").innerHTML=`<span class="k">vertex · uv (${uv.map(f2).join(", ")})</span><span class="cR">T ${v(T)}</span><br><span class="cG">B ${v(B)}</span><br><span class="cB">N ${v(N)}</span>`; }
  return { enter(){ show(null); },
    tick(){ const eye=eyeOf(st,3.3), L=[2,2,2.5];
      const VP=litScene(cv,{mesh:"sphere",eye,light:L,albTex:"grid",nrm:0,amb:.35}); if(!VP) return;
      const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight; let best=null, bd=28;
      const vis=S.filter(k=>V3.dot(g(d.nrm,k,3),V3.sub(eye,g(d.pos,k,3)))>0.15);
      if(mouse) vis.forEach(k=>{ const [sx,sy]=toScreen(VP,g(d.pos,k,3),W,H), dd=Math.hypot(sx-mouse[0],sy-mouse[1]); if(dd<bd){ bd=dd; best=k; } });
      if(best!==pick){ pick=best; show(pick); }
      vis.forEach(k=>{ const p=g(d.pos,k,3), N=g(d.nrm,k,3), T=g(d.tan,k,4), B=V3.cross(N,T).map(v=>v*d.tan[k*4+3]), big=k===pick, s=big?.42:.14;
        const o=toScreen(VP,p,W,H); x.globalAlpha=big||pick==null?1:.45;
        [[T,RED],[B,GREEN],[N,BLUE]].forEach(([a,c])=>{ const q=toScreen(VP,[p[0]+a[0]*s,p[1]+a[1]*s,p[2]+a[2]*s],W,H); arrow2d(x,o[0],o[1],q[0],q[1],c,big?4:2,big?13:7); });
        if(big){ const lab=(a,t,c)=>{ const q=toScreen(VP,[p[0]+a[0]*s*1.18,p[1]+a[1]*s*1.18,p[2]+a[2]*s*1.18],W,H); label(x,t,q[0],q[1]+5,c,18,"center"); }; lab(T,"T",RED); lab(B,"B",GREEN); lab(N,"N",BLUE); }
      }); x.globalAlpha=1; } }; })();

/* ---------- orthonormal matrix: step through v·M (3D view, tilted so z shows) ---------- */
A.ortho=(()=>{ const svg=$("orSvg"); let step=0, ang=50; const v=[.8,.35,.5];
  const orS=slider("orA",a=>a+"°",a=>{ ang=a; draw(); });
  // fixed orthographic view: turn a little about y, then tip a little about x, so +z comes out toward the lower left
  const O=[330,320], S=165, cb=Math.cos(-.6), sb=Math.sin(-.6), cc=Math.cos(.45), sc=Math.sin(.45);
  const P2=p=>{ const x=p[0]*cb+p[2]*sb, z=-p[0]*sb+p[2]*cb, y=p[1]*cc-z*sc; return [O[0]+x*S,O[1]-y*S]; };
  const add=(a,b)=>a.map((v,i)=>v+b[i]), sc3=(a,k)=>a.map(v=>v*k);
  function line(p,q,attrs){ const [x1,y1]=P2(p),[x2,y2]=P2(q); svgEl("line",{x1,y1,x2,y2,...attrs},svg); }
  function draw(){ svg.innerHTML=""; const a=ang*Math.PI/180, X=[Math.cos(a),Math.sin(a),0], Yv=[-Math.sin(a),Math.cos(a),0], Z=[0,0,1];
    // grid on the z = 0 plane
    for(let i=-3;i<=3;i++){ const t=i*.4; line([t,-1.2,0],[t,1.2,0],{stroke:"#202026"}); line([-1.2,t,0],[1.2,t,0],{stroke:"#202026"}); }
    // the original axes, faint
    [[[1,0,0],"x"],[[0,1,0],"y"],[[0,0,1],"z"]].forEach(([e,t])=>{ line([0,0,0],sc3(e,1.45),{stroke:"#3a3a44","stroke-width":2,"stroke-dasharray":"4 6"}); textSvg(svg,t,...P2(sc3(e,1.55)),"#55545c",16,"middle"); });
    // v in its own (local) space, faint, with a drop line to the plane so its height reads
    line(v,[v[0],v[1],0],{stroke:"rgba(155,152,143,.35)","stroke-width":2,"stroke-dasharray":"3 5"});
    arrowSvg(svg,...P2([0,0,0]),...P2(v),"rgba(155,152,143,.5)",3,"6 6"); textSvg(svg,"v (local)",...P2(add(v,[.04,.06,0])),MUTE,16);
    // the rotated axes = the rows of M
    [[X,RED,"X′"],[Yv,GREEN,"Y′"],[Z,BLUE,"Z′"]].forEach(([e,c,t])=>{ arrowSvg(svg,...P2([0,0,0]),...P2(e),c,4); textSvg(svg,t,...P2(sc3(e,1.14)),c,20,"middle",600); });
    const p1=sc3(X,v[0]), p2=add(p1,sc3(Yv,v[1])), tip=add(p2,sc3(Z,v[2]));
    if(step>=1) arrowSvg(svg,...P2([0,0,0]),...P2(p1),RED,6);
    if(step>=2) arrowSvg(svg,...P2(p1),...P2(p2),GREEN,6);
    if(step>=3){ arrowSvg(svg,...P2(p2),...P2(tip),BLUE,6);
      arrowSvg(svg,...P2([0,0,0]),...P2(tip),Y,5); const t2=P2(tip); textSvg(svg,"v·M",t2[0]-10,t2[1]-8,Y,20,"end",600); }
    const o=P2([0,0,0]); svgEl("circle",{cx:o[0],cy:o[1],r:5,fill:INK},svg);
    const M=[X,Yv,Z], C=["cR","cG","cB"];
    $("orMat").innerHTML=M.map((r,i)=>r.map(n=>`<span class="${C[i]}">${f2(n)}</span>`).join("")).join("");
    $("orRes").textContent=step>=3?`= (${tip.map(f2).join(", ")})`:"";
    $("orSteps").querySelectorAll("div").forEach((e,i)=>{ e.classList.toggle("on",i<=step); e.classList.toggle("cur",i===step); }); }
  return { enter(dir){ step=dir<0?3:0; orS.set(ang); }, step(){ if(step<3){ step++; draw(); return true; } return false; }, back(){ if(step>0){ step--; draw(); return true; } return false; } }; })();

/* ---------- TBN static diagram ---------- */
(() => { const svg=$("tbSvg");
  // a tilted tile in oblique projection
  const pr=p=>[320+p[0]*190+p[2]*-95,330-p[1]*190+p[2]*55];
  const T=[1,0,0], B=[0,0,1], N=[0,1,0];
  const q=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1]].map(p=>pr(p.map(v=>v*.9)));
  svgEl("polygon",{points:q.map(p=>p.join(",")).join(" "),fill:"rgba(106,184,255,.08)",stroke:"#3a3a44","stroke-width":2},svg);
  const o=pr([0,0,0]);
  [[T,RED,"T  (+U)"],[B,GREEN,"B  (+V)"],[N,BLUE,"N"]].forEach(([a,c,t])=>{ const e=pr(a.map(v=>v*1.05)); arrowSvg(svg,...o,...e,c,6); textSvg(svg,t,e[0]+(a===B?-30:12),e[1]+(a===N?-10:a===B?32:8),c,22,"start",600); });
  const nm=V3.norm([.35,1,.25]), e=pr(nm.map(v=>v*.9)); arrowSvg(svg,...o,...e,Y,4,"7 6"); textSvg(svg,"map normal",e[0]+12,e[1]-6,Y,18);
  svgEl("circle",{cx:o[0],cy:o[1],r:7,fill:INK},svg);
  textSvg(svg,"one vertex, its tangent space",30,510,MUTE,16);
})();

/* ---------- code tips ---------- */
codeTips($("vsCode"),$("vsTip"),[
  [1,7,`<span class="k">vertex input</span>The tangent is a 4th attribute: a <code>float3</code> pointing along <b>+U</b> on the surface.`],
  [6,6,`<span class="k">tangent</span>Comes from the mesh. Model importers (e.g. Assimp with <code>aiProcess_CalcTangentSpace</code>) compute it from the UVs.`],
  [8,15,`<span class="k">output</span>Only <b>normal</b> and <b>tangent</b> go to the fragment shader. The rasterizer blends them across the triangle; B and the TBN are built per pixel.`],
  [19,21,`<span class="k">position</span>Same as before: model → world → clip space. <code>object.model</code> and <code>frame.viewProjection</code> come from vertex uniform buffers.`],
  [23,23,`<span class="k">normal → world</span>Normals use the <b>normal matrix</b> (inverse-transpose of the model matrix), so non-uniform scale doesn’t tilt them.`],
  [24,24,`<span class="k">tangent → world</span>The tangent lies <b>along</b> the surface, like an edge, so it uses the model matrix itself.`]
],`<span class="k">vertex shader</span>Move <b>N</b> and <b>T</b> into world space and pass them on. The TBN is built in the fragment shader.`);
codeTips($("psCode"),$("psTip"),[
  [1,4,`<span class="k">two texture slots</span>Slot 0 is albedo (<code>t0</code>/<code>s0</code>) and slot 1 is the normal map (<code>t1</code>/<code>s1</code>). Create the normal map texture as <code>R8G8B8A8_UNORM</code>, <b>not</b> <code>_UNORM_SRGB</code>. It holds data, not color.`],
  [5,8,`<span class="k">light</span>A fragment uniform buffer (<code>b0, space3</code>), pushed with <code>SDL_PushGPUFragmentUniformData</code>.`],
  [9,15,`<span class="k">input</span>Interpolated normal and tangent. After interpolation they are no longer unit length or exactly perpendicular.`],
  [20,20,`<span class="k">decode</span>Sample the map and turn color (0…1) into a direction (−1…1).<br><br>To make bumps stronger or weaker, scale the tilt: <code>normal.xy *= normalStrength</code>.`],
  [22,23,`<span class="k">Gram-Schmidt</span>Normalize N, then remove any part of T that points along N, so T and N are exactly <b>perpendicular</b>.`],
  [24,24,`<span class="k">bitangent</span>The third axis is perpendicular to both: <code>B = cross(N, T)</code>.`],
  [25,25,`<span class="k">TBN</span><code>float3x3(a, b, c)</code> puts <b>a, b, c in the rows</b>.`],
  [26,26,`<span class="k">tangent → world</span>Rows are T, B, N, so the vector goes on the <b>left</b>: <code>mul(normal, TBN)</code> = n.x·T + n.y·B + n.z·N.`],
  [28,30,`<span class="k">lighting</span>Ordinary diffuse lighting, now with the per-pixel normal <b>N</b>.`]
],`<span class="k">fragment shader</span>Decode the map, build the TBN, rotate the normal into world space, then light with it.`);

/* ---------- tangent-space code tips ---------- */
codeTips($("tvsCode"),$("tvsTip"),[
  [1,4,`<span class="k">light, per vertex</span>The light position is now needed in the <b>vertex</b> shader, so it moves to a vertex uniform buffer (<code>space1</code>), pushed with <code>SDL_PushGPUVertexUniformData</code>. Use the next free slot after your frame and object buffers.`],
  [5,11,`<span class="k">vertex input</span>Same four attributes as the world-space version, tangent included.`],
  [12,17,`<span class="k">output</span>No normal or tangent goes to the fragment shader. Only the <b>light vector in tangent space</b>, which the rasterizer interpolates.`],
  [22,23,`<span class="k">position</span>Same as before: model → world → clip space. The world position is kept local so we can build L.`],
  [25,26,`<span class="k">N and T → world</span>Normal through the normal matrix, tangent through the model matrix, exactly as before.`],
  [27,28,`<span class="k">Gram-Schmidt + bitangent</span>Make T perpendicular to N, then <code>B = cross(N, T)</code>. Same steps, now per vertex.`],
  [29,29,`<span class="k">TBN</span>Rows are T, B, N, the same matrix as the world-space version.`],
  [31,31,`<span class="k">L in world space</span>Point from the surface to the light. Don’t normalize yet: an unnormalized vector interpolates more accurately.`],
  [32,32,`<span class="k">world → tangent</span>Vector on the <b>right</b>: <code>mul(TBN, L)</code> = (T·L, B·L, N·L). That multiplies by the <b>transpose</b>, which is the inverse of a rotation.<br><br>For specular, do the same to the view vector V.`]
],`<span class="k">vertex shader</span>Build the TBN per vertex and use its transpose to rotate the <b>light</b> into tangent space.`);
codeTips($("tpsCode"),$("tpsTip"),[
  [1,4,`<span class="k">two texture slots</span>Unchanged: albedo in slot 0, normal map in slot 1, created as <code>R8G8B8A8_UNORM</code>.`],
  [5,8,`<span class="k">light</span>The position moved to the vertex shader. Only color and ambient stay in the fragment uniform buffer.`],
  [9,12,`<span class="k">input</span>Just the UV and the interpolated tangent-space light vector. No normal, no tangent.`],
  [18,19,`<span class="k">decode</span>Turn color (0…1) into a direction (−1…1). This normal is <b>already in tangent space</b>, so it is used as-is.`],
  [21,21,`<span class="k">renormalize</span>Interpolation shortens the vector, so normalize it per pixel.`],
  [22,23,`<span class="k">lighting</span>Same diffuse term. Both vectors are in tangent space, so the dot product gives the same answer as in world space.`]
],`<span class="k">fragment shader</span>Sample the map and light with it directly. The space change already happened per vertex.`);

/* ---------- two spaces ---------- */
A.spaces=(()=>{ const svg=$("spSvg"); let mode="world", rot=0, target=0; const th=28*Math.PI/180;
  const nT=V3.norm([.42,0,.9]);           // map normal (tangent space): x along T, z along N
  const Lw=V3.norm([-.55,0,.83]);           // light direction in world (x right, z up in this 2D slice)
  const tip={world:`<span class="k">world space</span>Rotate the <b>normal</b> into world space: <code>N = mul(n, TBN)</code>. The light stays where it is.<br><br>Done per pixel in the fragment shader.`,
    tangent:`<span class="k">tangent space</span>Rotate the <b>light</b> (and view) into tangent space: <code>L′ = mul(TBN, L)</code>, the transpose. The map normal is used as-is.<br><br>The surface now lies flat, like the texture.`};
  tabs($("spMode"),k=>{ mode=k; target=k==="world"?0:1; $("spTip").innerHTML=tip[k]; })("world"); $("spTip").innerHTML=tip.world;
  const O=[350,380], S=230;
  const R=(v,a)=>[v[0]*Math.cos(a)-v[2]*Math.sin(a),v[0]*Math.sin(a)+v[2]*Math.cos(a)];
  return { tick(dt){ rot+=(target-rot)*Math.min(1,dt/180); const view=-th*rot;   // rotate the whole picture into tangent space
    svg.innerHTML=""; const P2=(v,a=0)=>{ const q=R(v,a); return [O[0]+q[0]*S,O[1]-q[1]*S]; };
    const surf=a=>[[-1.3,0,0],[1.3,0,0]].map(p=>P2([p[0]*Math.cos(th),0,p[0]*Math.sin(th)],a));
    const [s1,s2]=surf(view); svgEl("line",{x1:s1[0],y1:s1[1],x2:s2[0],y2:s2[1],stroke:INK,"stroke-width":5,"stroke-linecap":"round"},svg);
    const T=[Math.cos(th),0,Math.sin(th)], N=[-Math.sin(th),0,Math.cos(th)];
    const o=P2([0,0,0]); arrowSvg(svg,...o,...P2(T.map(v=>v*.75),view),RED,4); arrowSvg(svg,...o,...P2(N.map(v=>v*.75),view),BLUE,4);
    const tl=P2(T.map(v=>v*.84),view), nl=P2(N.map(v=>v*.84),view); textSvg(svg,"T",tl[0],tl[1]+6,RED,20,"middle",600); textSvg(svg,"N",nl[0]+14,nl[1]+4,BLUE,20,"middle",600);
    const nW=[T[0]*nT[0]+N[0]*nT[2],0,T[2]*nT[0]+N[2]*nT[2]];
    const ne=P2(nW.map(v=>v*.95),view); arrowSvg(svg,...o,...ne,Y,5); textSvg(svg,"n",ne[0]+10,ne[1]-6,Y,22,"start",600);
    const le=P2(Lw.map(v=>v*.95),view); arrowSvg(svg,...o,...le,AMBER,5,"9 7"); const lm=P2(Lw.map(v=>v*.6),view); textSvg(svg,"L",lm[0]-16,lm[1],AMBER,22,"end",600);
    svgEl("circle",{cx:le[0]+(le[0]-o[0])*.18,cy:le[1]+(le[1]-o[1])*.18,r:14,fill:Y,opacity:.9},svg);
    svgEl("circle",{cx:o[0],cy:o[1],r:6,fill:INK},svg);
    $("spCap").textContent=rot<.5?"world space: the surface is tilted":"tangent space: T along x, N along z";
    const LT=[V3.dot(Lw,T),0,V3.dot(Lw,N)], d=V3.dot(nW,Lw);
    $("spRead").innerHTML=mode==="world"?`<span class="k">world space</span>N = (${f2(nW[0])}, ${f2(nW[2])}) · L = (${f2(Lw[0])}, ${f2(Lw[2])})<br>dot(N, L) = <b>${d.toFixed(2)}</b>`
      :`<span class="k">tangent space</span>n = (${f2(nT[0])}, ${f2(nT[2])}) · L′ = (${f2(LT[0])}, ${f2(LT[2])})<br>dot(n, L′) = <b>${V3.dot(nT,LT).toFixed(2)}</b>`; } }; })();

/* ---------- bugs ---------- */
A.bugs=(()=>{ const cv=$("bgCv"), st=orbit(cv,{yaw:0,pitch:-.2}); let bug=0, show=0, t=0;
  const TIP=[`<span class="k">correct</span>Map decoded with <code>* 2 − 1</code>, rotated with TBN, stored in a <code>UNORM</code> texture. Bumps are lit from the side the light is on.`,
    `<span class="k">Y+ map, green flipped</span>Normal maps come in two conventions. <b>Y−</b> (DirectX-style) matches SDL3 GPU’s top-left UVs. A <b>Y+</b> (OpenGL-style) map makes bumps look lit from <b>above when the light is below</b>, like dents. Fix: <code>n.y = -n.y</code>, or invert green in an image editor.`,
    `<span class="k">loaded as sRGB</span>An <code>_UNORM_SRGB</code> format makes the GPU “gamma-decode” the texel, so 0.5 turns into about 0.22. Every normal tilts the wrong way and the surface goes dark. Normal maps are <b>data</b>, so use <code>R8G8B8A8_UNORM</code>.`,
    `<span class="k">forgot * 2 − 1</span>Colors are 0…1, so x and y can never be negative. Every normal leans toward +x +y, and the lighting looks smeared in one direction.`,
    `<span class="k">no TBN</span>The map normal is used as a world normal. It only looks right where the surface faces world +Z.`];
  tabs($("bgMode"),k=>{ bug=+k; $("bgTip").innerHTML=TIP[bug]; })("0"); $("bgTip").innerHTML=TIP[0];
  toggle($("bgShow"),v=>show=+v);
  return { tick(dt){ t+=dt/1000; const eye=eyeOf(st,3.1), L=[Math.cos(t*.6)*2.4,Math.sin(t*.9)*1.6,Math.sin(t*.6)*2.4+.4];
    const VP=litScene(cv,{mesh:"sphere",eye,light:L,tiling:[3,1.5],bug,show}); lightDot(cv,VP,L);
    $("bgCap").textContent=["correct","Y+ map","sRGB format","no decode","no TBN"][bug]; } }; })();

/* ---------- navigation ---------- */
const countEl=$("count"), prog=$("progress");
/*LIVE_CORE*/

function go(i,fromHash){
  i=Math.max(0,Math.min(slides.length-1,i));
  const capS=liveCap(); if(i>capS){ if(cur>=capS) toast("Waiting for your instructor…"); i=capS; }
  if(i===cur) return;
  const dir=i>cur?1:-1;
  if(cur>=0) slides[cur].classList.remove("active");
  cur=i; const s=slides[cur]; s.classList.add("active");
  s.querySelectorAll("canvas").forEach(fitCanvas);
  const a=A[s.dataset.id]; if(a&&a.enter) a.enter(dir);
  countEl.textContent=`${cur+1} / ${slides.length}`; prog.style.width=((cur+1)/slides.length*100)+"%";
  if(!fromHash){ try{ history.replaceState(null,"","#s"+(cur+1)); }catch(e){} }
  if(Live.role==="presenter"&&Live.locked) pushLive();
  if(Live.role!=="solo") renderLive();
}
function fromHash(){ const m=/^#s(\d+)$/.exec(location.hash); go(m?+m[1]-1:0,true); }
addEventListener("hashchange",fromHash);
function advance(){ const a=A[slides[cur].dataset.id]; if(a&&a.step&&a.step()) return; go(cur+1); }
function retreat(){ const a=A[slides[cur].dataset.id]; if(a&&a.back&&a.back()) return; go(cur-1); }
$("prev").onclick=retreat; $("next").onclick=advance;
function toggleFS(){ try{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(()=>{}); }catch(e){} }
$("fs").onclick=toggleFS;
addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT") return;
  const k=e.key;
  if(["ArrowRight","PageDown"].includes(k)||(k===" "&&e.target.tagName!=="BUTTON")){ advance(); e.preventDefault(); }
  else if(["ArrowLeft","PageUp"].includes(k)){ retreat(); e.preventDefault(); }
  else if(k==="Home") go(0); else if(k==="End") go(slides.length-1);
  else if(k==="f"||k==="F") toggleFS();
});
let sx=null; stage.addEventListener("touchstart",e=>{ if(e.target.closest("input,button,svg,canvas,table,.grabbable,pre")) return; sx=e.touches[0].clientX; },{passive:true});
stage.addEventListener("touchend",e=>{ if(sx===null) return; const dx=e.changedTouches[0].clientX-sx; if(Math.abs(dx)>60) (dx<0?advance:retreat)(); sx=null; });
addEventListener("resize",fitStage);
fitStage(); fromHash(); claudeAdapter();
let last=performance.now();
function loop(now){ const dt=Math.min(100,now-last); last=now; const s=slides[cur], a=s&&A[s.dataset.id]; if(a&&a.tick){ try{ a.tick(dt,now); }catch(err){ console.error(err); } } requestAnimationFrame(loop); }
requestAnimationFrame(loop);
})();
