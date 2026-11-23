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

/* ---------- images ---------- */
const IM={
  stones:img("{{IMG:stones.jpg}}"), bricks:img("{{IMG:bricks.jpg}}"), grass:img("{{IMG:grass.jpg}}"), kitten:img("{{IMG:kitten-filter.png}}"),
  scifi:img("{{IMG:scifi-albedo.jpg}}"), scifiE:img("{{IMG:scifi-emissive.jpg}}"), sky:img("{{IMG:sky-cross.jpg}}")
};

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

/* ---------- cube faces: one shared convention for the net, the direction demo and the WebGL skybox ----------
   camera looks down −Z (glm default): front = −Z. r/u = right and up as seen from inside the cube. cell = place in the 4×3 cross */
const FACES=[
  {k:"px",axis:"+X",name:"right", n:[1,0,0], r:[0,0,1],  u:[0,1,0],  cell:[2,1],layer:0},
  {k:"nx",axis:"−X",name:"left",  n:[-1,0,0],r:[0,0,-1], u:[0,1,0],  cell:[0,1],layer:1},
  {k:"py",axis:"+Y",name:"top",   n:[0,1,0], r:[1,0,0],  u:[0,0,1],  cell:[1,0],layer:2},
  {k:"ny",axis:"−Y",name:"bottom",n:[0,-1,0],r:[1,0,0],  u:[0,0,-1], cell:[1,2],layer:3},
  {k:"pz",axis:"+Z",name:"back",  n:[0,0,1], r:[-1,0,0], u:[0,1,0],  cell:[3,1],layer:4},
  {k:"nz",axis:"−Z",name:"front", n:[0,0,-1],r:[1,0,0],  u:[0,1,0],  cell:[1,1],layer:5}
];
function faceOf(d){ const ax=d.map(Math.abs), i=ax[0]>=ax[1]&&ax[0]>=ax[2]?0:ax[1]>=ax[2]?1:2; const f=FACES[i*2+(d[i]<0?1:0)];
  const m=ax[i]||1, p=d.map(v=>v/m), u=V3.dot(p,f.r), v=V3.dot(p,f.u); return {f,px:(u+1)/2,py:(1-v)/2,major:i,m}; }

/* ---------- one shared WebGL2 context, copied into each demo's 2D canvas ---------- */
const GL=(()=>{
  const cv=document.createElement("canvas");
  const gl=cv.getContext("webgl2",{antialias:true,preserveDrawingBuffer:true,alpha:false});
  if(!gl){ console.warn("WebGL2 not available"); return null; }
  const AN=gl.getExtension("EXT_texture_filter_anisotropic");
  const SETTER={[gl.FLOAT]:"uniform1f",[gl.FLOAT_VEC2]:"uniform2fv",[gl.FLOAT_VEC3]:"uniform3fv",[gl.FLOAT_VEC4]:"uniform4fv",[gl.INT]:"uniform1i",[gl.BOOL]:"uniform1i",[gl.SAMPLER_2D]:"uniform1i",[gl.SAMPLER_CUBE]:"uniform1i"};
  function program(vs,fs){
    const p=gl.createProgram();
    for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){ const sh=gl.createShader(t); gl.shaderSource(sh,"#version 300 es\nprecision highp float;\n"+s); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p,sh); }
    gl.bindAttribLocation(p,0,"aPos"); gl.bindAttribLocation(p,1,"aUV"); gl.bindAttribLocation(p,2,"aNrm");
    gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U={}; for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){ const a=gl.getActiveUniform(p,i); U[a.name]={loc:gl.getUniformLocation(p,a.name),type:a.type}; }
    return {p,U};
  }
  function use(pr,u){ gl.useProgram(pr.p); for(const k in u){ const e=pr.U[k]; if(!e) continue; const v=u[k];
    if(e.type===gl.FLOAT_MAT4) gl.uniformMatrix4fv(e.loc,false,v); else gl[SETTER[e.type]](e.loc,typeof v==="boolean"?+v:v); } }
  function mesh(d,mode){
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    [[0,d.pos,3],[1,d.uv,2],[2,d.nrm,3]].forEach(([loc,arr,n])=>{ if(!arr) return; const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,n,gl.FLOAT,false,0,0); });
    const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(d.idx),gl.STATIC_DRAW);
    gl.bindVertexArray(null); return {vao,count:d.idx.length,mode:mode??gl.TRIANGLES};
  }
  function draw(m){ gl.bindVertexArray(m.vao); gl.drawElements(m.mode,m.count,gl.UNSIGNED_INT,0); }
  // samplers are separate objects in WebGL2 too: the same idea as SDL_GPUSampler
  function sampler({min="mip",mag="linear",wrap="repeat",aniso=1}={}){
    const s=gl.createSampler(), W={repeat:gl.REPEAT,mirror:gl.MIRRORED_REPEAT,clamp:gl.CLAMP_TO_EDGE}[wrap];
    gl.samplerParameteri(s,gl.TEXTURE_MIN_FILTER,{mip:gl.LINEAR_MIPMAP_LINEAR,linear:gl.LINEAR,nearest:gl.NEAREST}[min]);
    gl.samplerParameteri(s,gl.TEXTURE_MAG_FILTER,mag==="nearest"?gl.NEAREST:gl.LINEAR);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R]) gl.samplerParameteri(s,p,W);
    if(AN) gl.samplerParameterf(s,AN.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(aniso,gl.getParameter(AN.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return s;
  }
  function blankTex(){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128,255])); return t; }
  function texFrom(source){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source); gl.generateMipmap(gl.TEXTURE_2D); return t; }
  function tex(im,prep){ const o={t:blankTex(),ready:false}; whenLoaded(im,()=>{ o.t=texFrom(prep?prep(im):im); o.ready=true; }); return o; }
  // build a cubemap from a horizontal-cross image: every texel of every GL face looks up the net with faceOf()
  function cubeFromCross(im,size=512){
    const o={t:gl.createTexture(),ready:false};
    whenLoaded(im,()=>{
      const W=Math.floor(im.naturalWidth/4), H=Math.floor(im.naturalHeight/3), c=document.createElement("canvas"); c.width=W*4; c.height=H*3;
      const x=c.getContext("2d"); x.drawImage(im,0,0,W*4,H*3); const src=x.getImageData(0,0,W*4,H*3).data, SW=W*4;
      gl.bindTexture(gl.TEXTURE_CUBE_MAP,o.t);
      const dirOf=[(s,t)=>[1,-t,-s],(s,t)=>[-1,-t,s],(s,t)=>[s,1,t],(s,t)=>[s,-1,-t],(s,t)=>[s,-t,1],(s,t)=>[-s,-t,-1]];
      for(let f=0;f<6;f++){ const out=new Uint8Array(size*size*4);
        for(let j=0;j<size;j++) for(let i=0;i<size;i++){
          const sc=2*(i+.5)/size-1, tc=2*(j+.5)/size-1, q=faceOf(dirOf[f](sc,tc));
          const sx=Math.min(W-1,Math.floor(q.px*W))+q.f.cell[0]*W, sy=Math.min(H-1,Math.floor(q.py*H))+q.f.cell[1]*H, si=(sy*SW+sx)*4, di=(j*size+i)*4;
          out[di]=src[si]; out[di+1]=src[si+1]; out[di+2]=src[si+2]; out[di+3]=255; }
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+f,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,out); }
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP); o.ready=true;
    });
    return o;
  }
  function bind(unit,target,t,s){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(target,t); gl.bindSampler(unit,s||null); }
  function render(target,fn){
    fitCanvas(target); const w=target.width, h=target.height; if(w<2||h<2) return;
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
    gl.viewport(0,0,w,h); gl.clearColor(.051,.051,.059,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    fn(w,h);
    const x=target.getContext("2d"); x.setTransform(1,0,0,1,0,0); x.drawImage(cv,0,0);
  }
  return {gl,AN,program,use,mesh,draw,sampler,tex,texFrom,cubeFromCross,bind,render};
})();

/* ---------- meshes ---------- */
const MESH={};
function quadData(){ return {pos:[-1,1,0, 1,1,0, 1,-1,0, -1,-1,0], uv:[0,0, 1,0, 1,1, 0,1], nrm:[0,0,1,0,0,1,0,0,1,0,0,1], idx:[0,1,2,0,2,3]}; }
function cubeData(){
  const pos=[],uv=[],nrm=[],idx=[];
  for(const f of FACES){ // outward faces; uv top-left = (0,0)
    const n=f.n, u=f.u, b=pos.length/3;
    // seen from outside: right = -(inside right)
    const R=[-f.r[0],-f.r[1],-f.r[2]];
    [[-1,1],[1,1],[1,-1],[-1,-1]].forEach(([a,c],k)=>{ pos.push(n[0]+R[0]*a+u[0]*c, n[1]+R[1]*a+u[1]*c, n[2]+R[2]*a+u[2]*c); uv.push((a+1)/2,(1-c)/2); nrm.push(...n); });
    idx.push(b,b+1,b+2,b,b+2,b+3);
  }
  return {pos,uv,nrm,idx};
}
function sphereData(R=1,la=48,lo=96){
  const pos=[],uv=[],nrm=[],idx=[];
  for(let i=0;i<=la;i++){ const th=i/la*Math.PI; for(let j=0;j<=lo;j++){ const ph=j/lo*Math.PI*2; const n=[Math.sin(th)*Math.sin(ph),Math.cos(th),Math.sin(th)*Math.cos(ph)];
    pos.push(...n.map(v=>v*R)); nrm.push(...n); uv.push(j/lo,i/la); } }
  for(let i=0;i<la;i++) for(let j=0;j<lo;j++){ const a=i*(lo+1)+j, b=a+lo+1; idx.push(a,b,a+1,a+1,b,b+1); }
  return {pos,uv,nrm,idx};
}
function torusData(R=.85,r=.38,a=96,b=48){
  const pos=[],uv=[],nrm=[],idx=[];
  for(let i=0;i<=a;i++){ const u=i/a*Math.PI*2; for(let j=0;j<=b;j++){ const v=j/b*Math.PI*2;
    const n=[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)]; pos.push((R+r*Math.cos(v))*Math.cos(u),r*Math.sin(v),(R+r*Math.cos(v))*Math.sin(u)); nrm.push(...n); uv.push(i/a*3,j/b); } }
  for(let i=0;i<a;i++) for(let j=0;j<b;j++){ const p=i*(b+1)+j, q=p+b+1; idx.push(p,q,p+1,p+1,q,q+1); }
  return {pos,uv,nrm,idx};
}
function edgesData(){ const pos=[],idx=[]; for(let i=0;i<8;i++) pos.push(i&1?1:-1,i&2?1:-1,i&4?1:-1);
  for(let i=0;i<8;i++) for(const b of [1,2,4]) if(!(i&b)) idx.push(i,i|b); return {pos,idx}; }

/* ---------- shaders (GLSL ES for the browser; the slides show the HLSL you write for SDL3 GPU) ---------- */
const P={};
const SRC={
  texV:`in vec3 aPos; in vec2 aUV; uniform mat4 uMVP; uniform vec2 uTiling, uOffset; out vec2 vUV; out vec2 vRaw;
    void main(){ vRaw=aUV; vUV=aUV*uTiling+uOffset; gl_Position=uMVP*vec4(aPos,1.); }`,
  texF:`in vec2 vUV; in vec2 vRaw; uniform sampler2D uTex, uTex2; uniform int uMode, uOutline; uniform float uMix; out vec4 o;
    void main(){ vec4 a=texture(uTex,vUV), c=a;
      if(uMode==1) c=a*texture(uTex2,vUV); else if(uMode==2) c=mix(a,texture(uTex2,vUV),uMix); else if(uMode==3) c=min(a+texture(uTex2,vUV)*.6,1.);
      if(uOutline==1){ vec2 w=fwidth(vUV)*1.6; vec2 e=min(abs(vUV),abs(vUV-1.));
        bool inX=vUV.x>-w.x&&vUV.x<1.+w.x, inY=vUV.y>-w.y&&vUV.y<1.+w.y;
        if((e.x<w.x&&inY)||(e.y<w.y&&inX)) c=vec4(1.,.76,.05,1.); }
      o=vec4(c.rgb,1.); }`,
  litV:`in vec3 aPos; in vec2 aUV; in vec3 aNrm; uniform mat4 uModel, uVP; uniform vec2 uTiling; out vec3 vW, vN; out vec2 vUV;
    void main(){ vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; vN=mat3(uModel)*aNrm; vUV=aUV*uTiling; gl_Position=uVP*w; }`,
  litF:`in vec3 vW, vN; in vec2 vUV; uniform sampler2D uAlb, uSpec, uEmis; uniform int uUseAlb, uSpecMode, uUseEmis;
    uniform vec3 uLightPos, uLightCol, uCam; uniform float uLightI, uEmisS, uShine, uAmb; out vec4 o;
    void main(){ vec3 N=normalize(vN), L=normalize(uLightPos-vW), V=normalize(uCam-vW), H=normalize(L+V);
      vec3 alb=uUseAlb==1?texture(uAlb,vUV).rgb:vec3(.85);
      float mask=uSpecMode==2||uSpecMode==3?texture(uSpec,vUV).r:uSpecMode==1?1.:0.;
      if(uSpecMode==3){ o=vec4(vec3(mask),1.); return; }
      vec3 lc=uLightCol*uLightI;
      vec3 col=alb*uAmb*uLightI+lc*max(dot(N,L),0.)*alb+lc*pow(max(dot(N,H),0.),uShine)*mask;
      if(uUseEmis==1) col+=texture(uEmis,vUV).rgb*uEmisS;
      o=vec4(col,1.); }`,
  skyV:`in vec3 aPos; uniform mat4 uVP; out vec3 vDir; void main(){ vDir=aPos; gl_Position=uVP*vec4(aPos,1.); }`,
  skyF:`in vec3 vDir; uniform samplerCube uCube; out vec4 o; void main(){ o=vec4(texture(uCube,vDir).rgb,1.); }`,
  envV:`in vec3 aPos; in vec3 aNrm; uniform mat4 uModel, uVP; out vec3 vW, vN; void main(){ vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; vN=mat3(uModel)*aNrm; gl_Position=uVP*w; }`,
  envF:`in vec3 vW, vN; uniform samplerCube uCube; uniform vec3 uCam; uniform int uMode; uniform float uIOR; out vec4 o;
    void main(){ vec3 N=normalize(vN), I=normalize(vW-uCam); vec3 d=reflect(I,N);
      if(uMode==1){ vec3 t=refract(I,N,1./uIOR); if(dot(t,t)>0.) d=t; }
      vec3 c=texture(uCube,d).rgb; if(uMode==1) c*=vec3(.92,.97,1.); o=vec4(c,1.); }`,
  // the cube around the scene, seen from outside: walls facing the camera are dropped so you can look in
  boxV:`in vec3 aPos; in vec3 aNrm; uniform mat4 uVP; uniform float uB; out vec3 vDir, vW, vN; void main(){ vDir=aPos; vN=aNrm; vW=aPos*uB; gl_Position=uVP*vec4(vW,1.); }`,
  boxF:`in vec3 vDir, vW, vN; uniform samplerCube uCube; uniform vec3 uCam, uOnly; uniform float uAlpha; out vec4 o;
    void main(){ if(dot(uOnly,uOnly)>0.){ if(dot(vN,uOnly)<.5) discard; } else if(dot(vN,uCam-vW)>0.) discard; o=vec4(texture(uCube,vDir).rgb*.8,uAlpha); }`,   // uOnly: draw just that one face
  flatV:`in vec3 aPos; uniform mat4 uMVP; void main(){ gl_Position=uMVP*vec4(aPos,1.); }`,
  flatF:`uniform vec4 uColor; out vec4 o; void main(){ o=uColor; }`
};
const TX={}, SM={};
if(GL){
  try{
    P.tex=GL.program(SRC.texV,SRC.texF); P.lit=GL.program(SRC.litV,SRC.litF); P.sky=GL.program(SRC.skyV,SRC.skyF);
    P.env=GL.program(SRC.envV,SRC.envF); P.flat=GL.program(SRC.flatV,SRC.flatF); P.box=GL.program(SRC.boxV,SRC.boxF);
    MESH.quad=GL.mesh(quadData()); MESH.cube=GL.mesh(cubeData()); MESH.sphere=GL.mesh(sphereData()); MESH.torus=GL.mesh(torusData());
    MESH.edges=GL.mesh(edgesData(),GL.gl.LINES);
    MESH.floor=GL.mesh({pos:[-60,0,-200, 60,0,-200, 60,0,4, -60,0,4],uv:[0,0,1,0,1,1,0,1],nrm:[0,1,0,0,1,0,0,1,0,0,1,0],idx:[0,1,2,0,2,3]});
    TX.bricks=GL.tex(IM.bricks); TX.grass=GL.tex(IM.grass); TX.scifi=GL.tex(IM.scifi); TX.scifiE=GL.tex(IM.scifiE);
    TX.kitten=GL.tex(IM.kitten,im=>{ const c=document.createElement("canvas"); c.width=292; c.height=218; c.getContext("2d").drawImage(im,14,12,292,218,0,0,292,218); return c; });
    // specular map made from the brick photo: red bricks shiny, grey mortar dull
    TX.spec=GL.tex(IM.bricks,im=>{ const c=document.createElement("canvas"); c.width=c.height=512; const x=c.getContext("2d"); x.drawImage(im,0,0,512,512);
      const d=x.getImageData(0,0,512,512), p=d.data; for(let i=0;i<p.length;i+=4){ const red=p[i]-(p[i+1]+p[i+2])/2, v=clamp((red-18)/40,0,1)*clamp(.35+p[i]/255,0,1)*255; p[i]=p[i+1]=p[i+2]=v; }
      x.putImageData(d,0,0); return c; });
    TX.sky=GL.cubeFromCross(IM.sky,512);
    SM.mip=GL.sampler({min:"mip"}); SM.mipA=GL.sampler({min:"mip",aniso:16}); SM.lin=GL.sampler({min:"linear"}); SM.linA=GL.sampler({min:"linear",aniso:16});
    SM.r=GL.sampler({wrap:"repeat"}); SM.m=GL.sampler({wrap:"mirror"}); SM.c=GL.sampler({wrap:"clamp"});
    // mip levels tinted so you can see which level the GPU picks
    TX.levels={t:null,ready:false};
    whenLoaded(IM.bricks,()=>{ const gl=GL.gl, t=gl.createTexture(), cols=["#ff5a4e","#ff8a1f","#ffc20e","#5fd68a","#6ab8ff","#b18cff"]; gl.bindTexture(gl.TEXTURE_2D,t);
      for(let L=0,s=512;s>=1;L++,s>>=1){ const c=document.createElement("canvas"); c.width=c.height=s; const x=c.getContext("2d"); x.drawImage(IM.bricks,0,0,s,s); x.globalAlpha=.6; x.fillStyle=cols[L%6]; x.fillRect(0,0,s,s);
        gl.texImage2D(gl.TEXTURE_2D,L,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c); }
      TX.levels.t=t; TX.levels.ready=true; });
  }catch(e){ console.error(e); }
}
function noGL(cv,msg="This demo needs WebGL2."){ const x=ctxOf(cv); x.fillStyle="#0d0d0f"; x.fillRect(0,0,cv.offsetWidth,cv.offsetHeight); label(x,msg,cv.offsetWidth/2,cv.offsetHeight/2,MUTE,18,"center"); }
// drag to orbit: returns state {yaw,pitch} updated by pointer drags on el
function orbit(el,st,{minP=-1.2,maxP=1.2,k=.008}={}){
  let last=null;
  el.addEventListener("pointerdown",e=>{ last=[e.clientX,e.clientY]; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove",e=>{ if(!last) return; st.yaw+=(e.clientX-last[0])*k; st.pitch=clamp(st.pitch+(e.clientY-last[1])*k,minP,maxP); last=[e.clientX,e.clientY]; st.moved=true; });
  el.addEventListener("pointerup",()=>last=null); el.addEventListener("pointercancel",()=>last=null);
  return st;
}

/* ---------- title + recap: a textured floor scrolling toward you ---------- */
function floorBg(id,col){
  const cv=$(id); let t0=0;
  return {
    enter(){ t0=performance.now(); },
    tick(dt,now){
      const x=ctxOf(cv), W=1600, H=900, hz=430, t=(now-t0)/1000; x.fillStyle="#121214"; x.fillRect(0,0,W,H);
      const f=520, camH=1.6, sc=(t*.9)%2;
      for(let j=40;j>=0;j--){ const z0=j-sc+.6, z1=z0+1; if(z0<.4) continue;
        for(let i=-16;i<16;i++){ if((i+j)&1) continue;
          const p=[[i,z0],[i+1,z0],[i+1,z1],[i,z1]].map(([X,Z])=>[W/2+X/Z*f,hz+camH/Z*f]);
          const a=Math.max(0,.28-z0*.007); x.fillStyle=`rgba(${col},${a})`; x.beginPath(); p.forEach(([px,py],k)=>k?x.lineTo(px,py):x.moveTo(px,py)); x.closePath(); x.fill(); } }
      const g=x.createLinearGradient(0,hz-10,0,hz+120); g.addColorStop(0,"rgba(18,18,20,1)"); g.addColorStop(1,"rgba(18,18,20,0)"); x.fillStyle=g; x.fillRect(0,hz-10,W,130);
    }
  };
}
A.title=floorBg("tiBg","255,194,14"); A.recap=floorBg("rcBg","106,184,255");
$("rcChips").innerHTML=["texel","UV coordinates","SDL_GPUTexture","transfer buffer","copy pass","texture types","texture formats","sampler","nearest / linear","anisotropic","mipmaps","address mode","tiling & offset","sampler slots","albedo map","specular map","emissive map","cubemap","skybox","environment mapping","reflect()","refract()","index of refraction"]
  .map(t=>`<span class="tag t-y">${t}</span>`).join("");

/* ---------- UV coordinates: drag the UVs, watch the triangle ---------- */
(() => {
  const tc=$("uvTex"), oc=$("uvOut"), COL=[RED,GREEN,BLUE];
  const PRE={full:[[.5,0],[0,1],[1,1]],half:[[.5,.25],[.3,.7],[.7,.7]],flip:[[.5,1],[0,0],[1,0]]};
  let P=PRE.full.map(p=>[...p]), drag=-1;
  const setPre=tabs($("uvPre"),k=>{ P=PRE[k].map(p=>[...p]); });
  const geo=()=>{ const w=tc.offsetWidth, h=tc.offsetHeight, s=Math.min(w-110,h-130); return {s,ox:(w-s)/2+20,oy:58}; };
  tc.addEventListener("pointerdown",e=>{ const [mx,my]=localXY(e,tc), g=geo(); let best=30; drag=-1;
    P.forEach((p,i)=>{ const d=Math.hypot(g.ox+p[0]*g.s-mx,g.oy+p[1]*g.s-my); if(d<best){ best=d; drag=i; } });
    if(drag>=0){ tc.setPointerCapture(e.pointerId); setPre(null); } });
  tc.addEventListener("pointermove",e=>{ if(drag<0) return; const [mx,my]=localXY(e,tc), g=geo(); P[drag]=[clamp((mx-g.ox)/g.s,0,1),clamp((my-g.oy)/g.s,0,1)]; });
  tc.addEventListener("pointerup",()=>drag=-1);
  A.uv={
    enter(){ P=PRE.full.map(p=>[...p]); setPre("full"); },
    tick(){
      const im=IM.stones; if(!im.complete) return;
      // texture space
      let x=ctxOf(tc), g=geo(); x.clearRect(0,0,tc.offsetWidth,tc.offsetHeight);
      x.drawImage(im,g.ox,g.oy,g.s,g.s); x.fillStyle="rgba(13,13,15,.35)"; x.fillRect(g.ox,g.oy,g.s,g.s);
      x.strokeStyle="rgba(243,241,234,.18)"; x.lineWidth=1; for(let k=1;k<4;k++){ x.beginPath(); x.moveTo(g.ox+k*g.s/4,g.oy); x.lineTo(g.ox+k*g.s/4,g.oy+g.s); x.moveTo(g.ox,g.oy+k*g.s/4); x.lineTo(g.ox+g.s,g.oy+k*g.s/4); x.stroke(); }
      x.strokeStyle=LINE; x.strokeRect(g.ox,g.oy,g.s,g.s);
      label(x,"(0,0)",g.ox-10,g.oy+4,Y,13,"right"); label(x,"u →",g.ox+g.s*.8,g.oy-10,MUTE,14,"center"); label(x,"1",g.ox+g.s,g.oy-10,MUTE,14,"center");
      x.save(); x.translate(g.ox-14,g.oy+g.s/2); x.rotate(-Math.PI/2); label(x,"← v",0,0,MUTE,14,"center"); x.restore(); label(x,"1",g.ox-18,g.oy+g.s+4,MUTE,14,"center");
      x.strokeStyle=Y; x.lineWidth=2.5; x.beginPath(); P.forEach((p,i)=>{ const X=g.ox+p[0]*g.s, Yy=g.oy+p[1]*g.s; i?x.lineTo(X,Yy):x.moveTo(X,Yy); }); x.closePath(); x.stroke();
      P.forEach((p,i)=>{ const X=g.ox+p[0]*g.s, Yy=g.oy+p[1]*g.s; dot(x,X,Yy,10,COL[i],"#0d0d0f"); });
      P.forEach((p,i)=>label(x,`${"ABC"[i]} (${p[0].toFixed(1)}, ${p[1].toFixed(1)})`,g.ox+i*g.s/3,g.oy+g.s+34,COL[i],13));
      // screen space: the same image drawn through the triangle with an affine map
      x=ctxOf(oc); const w=oc.offsetWidth, h=oc.offsetHeight; x.clearRect(0,0,w,h);
      const D=[[w/2,90],[40,h-110],[w-40,h-110]], S=P.map(p=>[p[0]*im.naturalWidth,p[1]*im.naturalHeight]);
      const det=(S[1][0]-S[0][0])*(S[2][1]-S[0][1])-(S[2][0]-S[0][0])*(S[1][1]-S[0][1]);
      x.save(); x.beginPath(); D.forEach((d,i)=>i?x.lineTo(d[0],d[1]):x.moveTo(d[0],d[1])); x.closePath(); x.clip();
      if(Math.abs(det)>1){
        // solve [a c e; b d f] mapping S -> D
        const [s0,s1,s2]=S, [d0,d1,d2]=D, ux=s1[0]-s0[0], uy=s1[1]-s0[1], vx=s2[0]-s0[0], vy=s2[1]-s0[1];
        const a=((d1[0]-d0[0])*vy-(d2[0]-d0[0])*uy)/det, c=((d2[0]-d0[0])*ux-(d1[0]-d0[0])*vx)/det;
        const b=((d1[1]-d0[1])*vy-(d2[1]-d0[1])*uy)/det, d=((d2[1]-d0[1])*ux-(d1[1]-d0[1])*vx)/det;
        const e=d0[0]-a*s0[0]-c*s0[1], f=d0[1]-b*s0[0]-d*s0[1], k=oc._k||1;
        x.setTransform(a*k,b*k,c*k,d*k,e*k,f*k); x.drawImage(im,0,0);
      } else { x.fillStyle="#222"; x.fillRect(0,0,w,h); }
      x.restore();
      x=ctxOf(oc); x.strokeStyle=LINE; x.lineWidth=2; x.beginPath(); D.forEach((d,i)=>i?x.lineTo(d[0],d[1]):x.moveTo(d[0],d[1])); x.closePath(); x.stroke();
      D.forEach((d,i)=>{ dot(x,d[0],d[1],10,COL[i],"#0d0d0f"); label(x,"ABC"[i],d[0]+(i===1?-4:i===2?4:18),d[1]+(i?32:6),COL[i],16,i===1?"left":i===2?"right":"left"); });
      label(x,"GPU interpolates UVs across the triangle",w/2,h-40,MUTE,14,"center");
    }
  };
})();

/* ---------- vertex input: position, texcoord and normal flow from the model into struct Input ---------- */
(() => {
  const cv=$("viCv"), ov=$("viOv"), box=$("viBox"), pre=$("viCode"), tip=$("viTip"), D=cubeData(), COL=[RED,GREEN,BLUE];
  const SEL=16, SLOTS=[16,17,18,19,8,9], BYTES=[12,8,12], OFF=[0,12,20], NAMES=["Position","TexCoord","Normal"];
  const TIPS=[
    "A model is a list of <b>vertices</b>. This cube has 24: 4 per face, so each face gets its own UVs and normal.",
    "Each vertex carries several <b>attributes</b>: a <b style=\"color:var(--red)\">position</b>, a <b style=\"color:var(--green)\">texcoord</b> (the UV) and a <b style=\"color:var(--blue)\">normal</b>.",
    "The attributes are packed into a <b>vertex buffer</b>, one vertex after another. Each vertex is 32 bytes: position at offset 0, texcoord at 12, normal at 20.",
    "The vertex shader runs once per vertex and receives it as <code>Input</code>. <b>TEXCOORD0/1/2</b> match the attribute locations 0/1/2 in the pipeline’s vertex input state.",
    "The shader passes the <b style=\"color:var(--green)\">texcoord</b> straight through. The rasterizer blends it across the triangle, and the pixel shader samples the texture with it."
  ];
  const HL=[[],[],[],[[1,6]],[[12,12]]];
  let k=0, t=0, T=0;
  const attr=(i,a)=>a===0?D.pos.slice(i*3,i*3+3):a===1?D.uv.slice(i*2,i*2+2):D.nrm.slice(i*3,i*3+3);
  const f1=v=>(v<0?"−":"")+Math.abs(v).toFixed(1);
  const xf=(m,p,w=1)=>{ const v=[p[0],p[1],p[2],w], o=[0,0,0,0]; for(let r=0;r<4;r++) for(let c=0;c<4;c++) o[r]+=m[c*4+r]*v[c]; return o; };
  function rel(el){ const o=ov.getBoundingClientRect(), r=el.getBoundingClientRect(), q=o.width/ov.offsetWidth; return {x:(r.left-o.left)/q,y:(r.top-o.top)/q,w:r.width/q,h:r.height/q}; }
  function show(){ hlLines(pre,HL[k]); tip.innerHTML=TIPS[k]; }
  const ease=p=>p<0?0:p>1?1:p*p*(3-2*p);
  function chip(x,px,py,col,w=26,h=14){ x.shadowColor=col; x.shadowBlur=12; x.fillStyle=col; x.beginPath(); x.roundRect(px-w/2,py-h/2,w,h,4); x.fill(); x.shadowBlur=0; }
  function fly(x,a,b,p,col,w,h){ const e=ease(p), mx=(a[0]+b[0])/2, my=Math.min(a[1],b[1])-60, u=1-e;
    chip(x,u*u*a[0]+2*u*e*mx+e*e*b[0],u*u*a[1]+2*u*e*my+e*e*b[1],col,w,h); }
  function draw(){
    if(!GL||!P.tex) return noGL(cv); if(!TX.bricks.ready) return;
    const A=.62+.42*Math.sin(T*.0005), bw=box.offsetWidth, bh=box.offsetHeight;
    const Mdl=M4.chain(M4.RX(.42),M4.RY(A)), V=M4.lookAt([0,0,7.2],[0,0,0],[0,1,0]), MV=M4.mul(V,Mdl);
    const MVP=M4.chain(M4.T(.24,k>=2?.14:0,0),M4.persp(.8,bw/bh,.1,50),MV);
    GL.render(cv,()=>{ GL.bind(0,GL.gl.TEXTURE_2D,TX.bricks.t,SM.r); GL.use(P.tex,{uMVP:MVP,uTiling:[1,1],uOffset:[0,0],uTex:0,uMode:0,uOutline:1}); GL.draw(MESH.cube); });
    const x=ctxOf(ov), W=ov.offsetWidth, H=ov.offsetHeight; x.clearRect(0,0,W,H);
    const b=rel(box), scr=i=>{ const c=xf(MVP,attr(i,0)); return [b.x+(c[0]/c[3]*.5+.5)*bw, b.y+(.5-c[1]/c[3]*.5)*bh]; };
    const vis=i=>xf(MV,attr(i,2),0)[2]>.05;
    // vertex dots
    for(let i=0;i<24;i++) if(vis(i)){ const [px,py]=scr(i); dot(x,px,py,i===SEL&&k>=1?7:4.5,k>=1&&i!==SEL?"rgba(255,194,14,.55)":Y,"#0d0d0f"); }
    // one vertex and its attributes
    if(k>=1){ const [px,py]=scr(SEL), cx=b.x+18, cy=b.y+56, cw=290, ch=112;
      x.strokeStyle="rgba(255,194,14,.6)"; x.lineWidth=1.5; x.setLineDash([4,5]); x.beginPath(); x.moveTo(cx+cw,cy+ch/2); x.lineTo(px,py); x.stroke(); x.setLineDash([]);
      x.beginPath(); x.arc(px,py,12,0,7); x.stroke();
      x.fillStyle="rgba(20,20,24,.94)"; x.strokeStyle=LINE; x.beginPath(); x.roundRect(cx,cy,cw,ch,12); x.fill(); x.stroke();
      label(x,"vertex 16",cx+16,cy+24,MUTE,13);
      NAMES.forEach((n,a)=>{ const v=attr(SEL,a); x.fillStyle=COL[a]; x.fillRect(cx+16,cy+38+a*24,10,12); label(x,n,cx+34,cy+49+a*24,COL[a],14); label(x,`(${v.map(f1).join(", ")})`,cx+128,cy+49+a*24,INK,14); }); }
    // vertex buffer
    if(k>=2){ const vy=b.y+bh-160, vx=b.x+20, vw=bw-40, sw=vw/SLOTS.length, sh=34;
      label(x,"vertex buffer",vx,vy-12,INK,14); label(x,"stride = 32 bytes",vx+vw,vy-12,MUTE,13,"right");
      const filled=k===2?Math.min(SLOTS.length,Math.floor(t/450)):SLOTS.length, seg=(s,a)=>[vx+s*sw+OFF[a]/32*sw, BYTES[a]/32*sw];
      const cur=k===3?Math.floor(t/1100)%SLOTS.length:-1;
      for(let s=0;s<SLOTS.length;s++){ for(let a=0;a<3;a++){ const [sx,w]=seg(s,a); x.fillStyle=s<filled?COL[a]:"#1c1c21"; x.globalAlpha=s<filled?(s===cur||cur<0?1:.45):1; x.fillRect(sx+1,vy,w-2,sh); }
        x.globalAlpha=1; x.strokeStyle=s===cur?Y:"#0d0d0f"; x.lineWidth=s===cur?2:1; x.strokeRect(vx+s*sw+.5,vy,sw-1,sh); label(x,"v"+SLOTS[s],vx+s*sw+sw/2,vy+sh+18,MUTE,12,"center"); }
      [0,12,20].forEach(o=>label(x,String(o),vx+o/32*sw+3,vy+sh+36,Y,12,"left")); label(x,"32",vx+sw,vy+sh+36,MUTE,12,"center");
      if(k===2&&filled<SLOTS.length){ const s=filled, p=(t-s*450)/450, a0=scr(SLOTS[s]); for(let a=0;a<3;a++){ const [sx,w]=seg(s,a); fly(x,a0,[sx+w/2,vy+sh/2],p,COL[a],Math.max(10,w-4),sh-8); } }
      // into struct Input
      if(k===3){ const p=(t%1100)/800; for(let a=0;a<3;a++){ const [sx,w]=seg(cur,a), L=rel(pre._lines[2+a]);
          if(p<1) fly(x,[sx+w/2,vy+sh/2],[L.x+L.w*.62,L.y+L.h/2],p,COL[a],22,12);
          else { x.globalAlpha=1-(p-1)/.375; x.strokeStyle=COL[a]; x.lineWidth=2; x.strokeRect(L.x+2,L.y,L.w-4,L.h); x.globalAlpha=1; } } } }
    // texcoord passed on to the output
    if(k===4){ const a=rel(pre._lines[3]), o=rel(pre._lines[11]), p=(t%1300)/900;
      x.strokeStyle="rgba(95,214,138,.7)"; x.lineWidth=2; x.strokeRect(a.x+2,a.y,a.w-4,a.h);
      if(p<1) fly(x,[a.x+a.w*.62,a.y+a.h/2],[o.x+o.w*.55,o.y+o.h/2],p,GREEN,22,12); else { x.strokeStyle=GREEN; x.strokeRect(o.x+2,o.y,o.w-4,o.h); }
      label(x,"→ to the pixel shader",o.x+o.w-16,o.y+o.h/2+5,GREEN,14,"right"); }
  }
  A.vin={ enter(d){ k=d<0?4:0; t=d<0?1e5:0; show(); }, step(){ if(k>=4) return false; k++; t=0; show(); return true; },
    back(){ if(k<=0) return false; k--; t=1e5; show(); return true; }, tick(dt){ t+=dt; T+=dt; draw(); } };
})();

/* ---------- CPU → GPU: disk, RAM, bus, VRAM, parallel sampling ---------- */
(() => {
  const cv=$("cgCv"), lis=[...$("cgSteps").children], key=$("cgKey"), N=8;
  let k=0, t=0, tex=null, pairs=[], pt=-1;
  const hsh=(a,b)=>{ const s=Math.sin(a*127.1+b*311.7)*43758.5453; return s-Math.floor(s); };
  const rr=(x,X,Y,W,H,r)=>{ x.beginPath(); x.roundRect(X,Y,W,H,r); };
  function texels(){ if(tex) return tex; const im=IM.bricks; if(!im.complete||!im.naturalWidth) return null;
    const c=document.createElement("canvas"); c.width=c.height=N; const g=c.getContext("2d"); g.drawImage(im,0,0,N,N);
    const d=g.getImageData(0,0,N,N).data; tex=[]; for(let i=0;i<N*N;i++) tex.push(`rgb(${d[i*4]},${d[i*4+1]},${d[i*4+2]})`); return tex; }
  function show(){ lis.forEach((l,i)=>{ l.classList.toggle("on",i===k); l.classList.toggle("done",i<k); }); key.classList.toggle("on",k===3); }
  function draw(){
    const T=texels(); if(!T) return;
    const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight; x.clearRect(0,0,W,H);
    const pw=W*.36, cx0=22, gx0=W-22-pw, py=24, ph=H-48, cell=Math.floor(Math.min(pw-80,180)/N), gs=cell*N;
    const fileY=py+50, fileH=80, gridY=fileY+fileH+56, ramX=cx0+(pw-gs)/2, vramX=gx0+(pw-gs)/2, yBus=gridY+gs/2;
    const cellC=(X,i)=>[X+(i%N+.5)*cell, gridY+(Math.floor(i/N)+.5)*cell];
    // panels
    [[cx0,"CPU · system RAM",BLUE,k<=1?1:.6],[gx0,"GPU · video RAM",GREEN,k>=2?1:.4]].forEach(([X,ti,col,a])=>{
      x.globalAlpha=a; x.fillStyle="#141418"; x.strokeStyle=col; x.lineWidth=1.5; rr(x,X,py,pw,ph,16); x.fill(); x.globalAlpha=a*.45; x.stroke();
      x.globalAlpha=a; label(x,ti,X+18,py+30,col,15); x.globalAlpha=1; });
    // bus
    const busOn=k===2&&t<2300, bx0=cx0+pw, bx1=gx0;
    x.strokeStyle=busOn?Y:LINE; x.lineWidth=3; [-20,20].forEach(o=>{ x.beginPath(); x.moveTo(bx0,yBus+o); x.lineTo(bx1,yBus+o); x.stroke(); });
    if(busOn){ x.setLineDash([6,10]); x.lineDashOffset=-t/20; x.strokeStyle="rgba(255,194,14,.5)"; x.lineWidth=1.5; x.beginPath(); x.moveTo(bx0,yBus); x.lineTo(bx1,yBus); x.stroke(); x.setLineDash([]); }
    label(x,"PCIe bus",(bx0+bx1)/2,yBus-34,k===2?Y:MUTE,14,"center"); label(x,"~16–32 GB/s",(bx0+bx1)/2,yBus+46,MUTE,13,"center");
    // file on disk
    x.globalAlpha=k===0?1:.55; x.fillStyle="#1c1c21"; x.strokeStyle=k===0?Y:LINE; x.lineWidth=k===0?2:1; rr(x,cx0+18,fileY,pw-36,fileH,12); x.fill(); x.stroke();
    const ix=cx0+34, iy=fileY+12; x.fillStyle="#2a2a31"; x.beginPath(); x.moveTo(ix,iy); x.lineTo(ix+34,iy); x.lineTo(ix+46,iy+12); x.lineTo(ix+46,iy+56); x.lineTo(ix,iy+56); x.closePath(); x.fill();
    x.drawImage(IM.bricks,ix+7,iy+18,32,32);
    label(x,"bricks.png",ix+62,iy+24,INK,16); label(x,"on disk · compressed",ix+62,iy+46,MUTE,13);
    x.globalAlpha=1;
    // arrow file → RAM
    const ax=cx0+pw/2; x.strokeStyle=k===1?Y:LINE; x.fillStyle=x.strokeStyle; x.lineWidth=2; x.beginPath(); x.moveTo(ax,fileY+fileH+6); x.lineTo(ax,gridY-30); x.stroke();
    x.beginPath(); x.moveTo(ax-6,gridY-36); x.lineTo(ax+6,gridY-36); x.lineTo(ax,gridY-28); x.fill();
    label(x,"decode",ax+10,fileY+fileH+26,k===1?Y:MUTE,13);
    // grids
    const ramN=k===0?0:k===1?Math.min(N*N,Math.floor(t/1200*N*N)):N*N;
    const flight=i=>(t-i*22)/700, vramN=k<2?0:k===2?T.filter((_,i)=>flight(i)>=1).length:N*N;
    const grid=(X,n,a,lab,sub,col)=>{ x.globalAlpha=a; for(let i=0;i<N*N;i++){ x.fillStyle=i<n?T[i]:"#1c1c21"; x.fillRect(X+(i%N)*cell+1,gridY+Math.floor(i/N)*cell+1,cell-2,cell-2); }
      label(x,lab,X+gs/2,gridY-10,col,13,"center"); label(x,sub,X+gs/2,gridY+gs+22,MUTE,13,"center"); x.globalAlpha=1; };
    grid(ramX,ramN,k<=1?1:.6,"SDL_Surface (RGBA)","1024² × 4 B = 4 MB",k===1?BLUE:MUTE);
    grid(vramX,vramN,k>=2?1:.4,"SDL_GPUTexture",k===3?"VRAM: ~500+ GB/s":"same texels, now on the GPU",k>=2?GREEN:MUTE);
    // texels in flight
    if(k===2) for(let i=0;i<N*N;i++){ const p=flight(i); if(p<=0||p>=1) continue; const e=p*p*(3-2*p), u=1-e;
      const [sx,sy]=cellC(ramX,i), [dx,dy]=cellC(vramX,i);
      const px=u*u*u*sx+3*u*u*e*bx0+3*u*e*e*bx1+e*e*e*dx, pyy=u*u*u*sy+3*u*u*e*yBus+3*u*e*e*yBus+e*e*e*dy, s=cell*.7;
      x.shadowColor=Y; x.shadowBlur=10; x.fillStyle=T[i]; x.fillRect(px-s/2,pyy-s/2,s,s); x.shadowBlur=0; }
    // CPU cores: 8 big
    const cs=44, cg=10, cw=4*cs+3*cg, ccx=cx0+(pw-cw)/2, ccy=py+ph-140;
    for(let i=0;i<8;i++){ const X=ccx+(i%4)*(cs+cg), Yc=ccy+Math.floor(i/4)*(cs+cg);
      const lit=(k===1&&t<1200&&Math.floor(t/150)%8===i)||(k===3&&hsh(i,Math.floor(t/500))>.6);
      x.fillStyle=lit?BLUE:"#24242a"; rr(x,X,Yc,cs,cs,8); x.fill(); }
    label(x,k===3?"8 cores, free for game logic":"8 big cores",cx0+pw/2,py+ph-16,k===1||k===3?BLUE:MUTE,13,"center");
    // GPU cores: many small
    const gc=16, gr=8, gq=9, gp=4, gw=gc*(gq+gp)-gp, gcx=gx0+(pw-gw)/2, gcy=py+ph-150, slot=Math.floor(t/110);
    const coreC=j=>[gcx+(j%gc)*(gq+gp)+gq/2, gcy+Math.floor(j/gc)*(gq+gp)+gq/2];
    if(k===3){ if(slot!==pt){ pt=slot; pairs=[]; for(let n=0;n<34;n++) pairs.push([Math.floor(Math.random()*gc*gr),Math.floor(Math.random()*N*N)]); }
      x.strokeStyle="rgba(95,214,138,.28)"; x.lineWidth=1; pairs.forEach(([j,i])=>{ const [a,b]=coreC(j), [c,d]=cellC(vramX,i); x.beginPath(); x.moveTo(a,b); x.lineTo(c,d); x.stroke(); }); }
    for(let j=0;j<gc*gr;j++){ const [a,b]=coreC(j); x.fillStyle=k===3&&hsh(j,slot)>.35?GREEN:"#24242a"; x.globalAlpha=k>=2?1:.5; x.fillRect(a-gq/2,b-gq/2,gq,gq); }
    x.globalAlpha=1;
    if(k===3){ x.fillStyle="#141418"; x.fillRect(vramX-8,gridY+gs+6,gs+16,24); label(x,"VRAM: ~500+ GB/s",vramX+gs/2,gridY+gs+22,GREEN,13,"center"); }
    label(x,"thousands of small cores",gx0+pw/2,py+ph-16,k===3?GREEN:MUTE,13,"center");
    // per-frame stat
    if(k===3){ const sx=gx0+pw/2; label(x,"every frame at 1920×1080:",sx,fileY+24,MUTE,13,"center");
      label(x,"~2 million samples",sx,fileY+54,Y,22,"center"); label(x,"all in parallel",sx,fileY+78,MUTE,13,"center"); }
  }
  A.cpu2gpu={ enter(d){ k=d<0?3:0; t=d<0?1e5:0; show(); }, step(){ if(k>=3) return false; k++; t=0; show(); return true; },
    back(){ if(k<=0) return false; k--; t=1e5; show(); return true; }, tick(dt){ t+=dt; draw(); } };
})();

/* ---------- create texture: step through the code ---------- */
(() => {
  const pre=$("crCode"), nodes=[...$("crPipe").children], tip=$("crTip");
  const S=[
    {r:[[1,2]],t:"<b>IMG_Load</b> (from SDL_image) reads a PNG or JPG from disk and decodes it into an <b>SDL_Surface</b> in normal RAM."},
    {r:[[4,6]],t:"Convert it to <b>RGBA, 4 bytes per texel</b>. The GPU has no 3-byte RGB format, so a JPG must be converted first."},
    {r:[[8,16]],t:"Fill in an <b>SDL_GPUTextureCreateInfo</b>: type, format, usage, size, layers and mip levels."},
    {r:[[18,19]],t:"<b>SDL_CreateGPUTexture</b> makes the texture in GPU memory. It starts <b>empty</b>: the pixels are uploaded in the next step."}
  ]; let k=0;
  function show(){ hlLines(pre,S[k].r); tip.innerHTML=S[k].t; nodes.forEach((n,i)=>{ n.classList.toggle("on",i===k); n.classList.toggle("done",i<k); }); }
  A.create={ enter(d){ k=d<0?3:0; show(); }, step(){ if(k>=3) return false; k++; show(); return true; }, back(){ if(k<=0) return false; k--; show(); return true; } };
})();

/* ---------- upload: follow the pixels ---------- */
(() => {
  const pre=$("upCode"), nodes=[...$("upPipe").children], tip=$("upTip");
  const S=[
    {r:[[2,2],[9,9]],t:"The pixels start in an <b>SDL_Surface</b> in normal RAM. The GPU can’t read them there. <code>size</code> = width × height × 4 bytes."},
    {r:[[1,10]],t:"Make a <b>transfer buffer</b> (staging memory), <b>map</b> it to get a CPU pointer, <b>memcpy</b> the pixels in, then <b>unmap</b>."},
    {r:[[12,20]],t:"Record a <b>copy pass</b> in a command buffer. <code>SDL_UploadToGPUTexture</code> copies the transfer buffer into the texture when the GPU runs it."},
    {r:[[22,23]],t:"The texture now holds the image. <b>Release</b> the transfer buffer and the surface. Keep the texture until shutdown, then <code>SDL_ReleaseGPUTexture</code>."}
  ]; let k=0;
  function show(){ hlLines(pre,S[k].r); tip.innerHTML=S[k].t; nodes.forEach((n,i)=>{ n.classList.toggle("on",i===k); n.classList.toggle("done",i<k); }); }
  A.upload={ enter(d){ k=d<0?3:0; show(); }, step(){ if(k>=3) return false; k++; show(); return true; }, back(){ if(k<=0) return false; k--; show(); return true; } };
})();

/* ---------- texture types ---------- */
(() => {
  const T=[
    {k:"SDL_GPU_TEXTURETYPE_2D",n:"2D",d:"Width × height. Almost every texture: albedo, normal, UI, render targets.",
     tip:"<b>2D</b>: the everyday texture. <code>layer_count_or_depth = 1</code>. Sampled in HLSL as <code>Texture2D</code> with a <b>float2</b> UV.",
     svg:'<rect x="70" y="20" width="80" height="80" fill="#6ab8ff" opacity=".25" stroke="#6ab8ff" stroke-width="2"/><path d="M70 60h80M110 20v80" stroke="#6ab8ff" opacity=".6"/>'},
    {k:"SDL_GPU_TEXTURETYPE_2D_ARRAY",n:"2D_ARRAY",d:"A stack of same-size 2D images in one texture.",
     tip:"<b>2D array</b>: <code>layer_count_or_depth</code> = number of layers. Pick the layer in the shader: <code>Texture2DArray</code> with <b>float3(u, v, layer)</b>. Great for terrain layers or sprite frames.",
     svg:'<rect x="90" y="14" width="70" height="70" fill="#5fd68a" opacity=".15" stroke="#5fd68a"/><rect x="78" y="26" width="70" height="70" fill="#5fd68a" opacity=".2" stroke="#5fd68a"/><rect x="66" y="38" width="70" height="70" fill="#5fd68a" opacity=".3" stroke="#5fd68a" stroke-width="2"/>'},
    {k:"SDL_GPU_TEXTURETYPE_3D",n:"3D",d:"Width × height × depth. A volume of texels.",
     tip:"<b>3D</b>: <code>layer_count_or_depth</code> = depth. Sampled with <b>float3(u, v, w)</b> and filtered between slices. Used for fog, smoke, color-grading lookup tables.",
     svg:'<path d="M70 44l40-20 40 20v48l-40 20-40-20z" fill="#b18cff" opacity=".2" stroke="#b18cff" stroke-width="2"/><path d="M70 44l40 20 40-20M110 64v48" stroke="#b18cff" fill="none" stroke-width="2"/><path d="M70 60l40 20 40-20M70 76l40 20 40-20" stroke="#b18cff" opacity=".45" fill="none"/>'},
    {k:"SDL_GPU_TEXTURETYPE_CUBE",n:"CUBE",d:"Six square faces of a cube. Read with a direction.",
     tip:"<b>Cube</b>: <code>layer_count_or_depth = 6</code>, square faces. HLSL <code>TextureCube</code>, sampled with a <b>float3 direction</b>. Skyboxes and reflections (later in this deck).",
     svg:'<g fill="#ffc20e" fill-opacity=".25" stroke="#ffc20e" stroke-width="2"><rect x="88" y="12" width="32" height="32"/><rect x="56" y="44" width="32" height="32"/><rect x="88" y="44" width="32" height="32"/><rect x="120" y="44" width="32" height="32"/><rect x="152" y="44" width="32" height="32"/><rect x="88" y="76" width="32" height="32"/></g>'},
    {k:"SDL_GPU_TEXTURETYPE_CUBE_ARRAY",n:"CUBE_ARRAY",d:"Several cubemaps in one texture.",
     tip:"<b>Cube array</b>: <code>layer_count_or_depth</code> = 6 × number of cubes. Used for many reflection probes or point-light shadows. Check support with <code>SDL_GPUTextureSupportsFormat</code>.",
     svg:'<g fill="#ff8a1f" fill-opacity=".15" stroke="#ff8a1f"><rect x="100" y="8" width="24" height="24"/><rect x="76" y="32" width="24" height="24"/><rect x="100" y="32" width="24" height="24"/><rect x="124" y="32" width="24" height="24"/><rect x="148" y="32" width="24" height="24"/><rect x="100" y="56" width="24" height="24"/></g><g fill="#ff8a1f" fill-opacity=".3" stroke="#ff8a1f" stroke-width="2"><rect x="76" y="38" width="24" height="24"/><rect x="52" y="62" width="24" height="24"/><rect x="76" y="62" width="24" height="24"/><rect x="100" y="62" width="24" height="24"/><rect x="124" y="62" width="24" height="24"/><rect x="76" y="86" width="24" height="24"/></g>'}
  ];
  const box=$("tyCards"), tip=$("tyTip"), idle='<span class="k">hover a type</span>Every texture is created with one of these in <code>info.type</code>.';
  box.innerHTML=T.map((t,i)=>`<div class="card hcard" data-i="${i}"><svg viewBox="0 0 220 120">${t.svg}</svg><span class="nm">${t.n}</span><p>${t.d}</p></div>`).join("");
  const cards=[...box.children];
  cards.forEach((c,i)=>{ c.addEventListener("mouseenter",()=>{ cards.forEach(o=>o.classList.toggle("on",o===c)); tip.innerHTML=`<span class="k">${T[i].k}</span>${T[i].tip}`; }); });
  A.types={ enter(){ cards.forEach(o=>o.classList.remove("on")); tip.innerHTML=idle; } };
})();

/* ---------- texture formats + memory calculator ---------- */
(() => {
  const F=[
    ["R8G8B8A8_UNORM",4,"color textures (what we load)"],
    ["R8G8B8A8_UNORM_SRGB",4,"color textures, gamma-correct"],
    ["B8G8R8A8_UNORM",4,"common swapchain format"],
    ["R8_UNORM",1,"one channel: masks, specular"],
    ["R16G16B16A16_FLOAT",8,"HDR color, bright lights"],
    ["D32_FLOAT",4,"depth buffer"],
    ["D24_UNORM_S8_UINT",4,"depth + stencil (check support)"],
    ["BC7_RGBA_UNORM",1,"compressed color, 4:1"],
    ["BC1_RGBA_UNORM",.5,"compressed, 8:1, no smooth alpha"]
  ];
  const tb=$("fmTable"), calc=$("fmCalc"); let sel=0, size=1024;
  tb.innerHTML="<tr><th>SDL_GPU_TEXTUREFORMAT_…</th><th class='r'>bytes / texel</th><th>used for</th></tr>"+F.map((f,i)=>`<tr class="pick" data-i="${i}"><td>${f[0]}</td><td class="r">${f[1]}</td><td><span class="sub">${f[2]}</span></td></tr>`).join("");
  const rows=[...tb.querySelectorAll("tr.pick")];
  rows.forEach(r=>r.onclick=()=>{ sel=+r.dataset.i; upd(); });
  const mb=b=>b>=1048576?fmt(b/1048576,1)+" MB":fmt(b/1024,1)+" KB";
  function upd(){ rows.forEach((r,i)=>r.classList.toggle("on",i===sel)); const f=F[sel], b=size*size*f[1];
    calc.innerHTML=`<span class="k">${f[0]}</span>${size} × ${size} × ${f[1]} bytes = <b>${mb(b)}</b><br>with mipmaps (× 4/3) = <b>${mb(b*4/3)}</b><br><span class="muted">as a cubemap (× 6) = ${mb(b*6*4/3)}</span>`; }
  const sz=slider("fmSize",v=>(1<<v)+"²",v=>{ size=1<<v; upd(); });
  A.formats={ enter(){ sel=0; sz.set(10); } };
})();

/* ---------- hover tips on shader / sampler code ---------- */
codeTips($("hsCode"),$("hsTip"),[
  [1,1,"<span class='k'>t0 · space2</span>The texture in <b>slot 0</b>. In SDL3 GPU, fragment-shader textures live in <b>space2</b>. On the C++ side, set <code>num_samplers = 1</code> when you create the shader."],
  [2,2,"<span class='k'>s0 · space2</span>The <b>sampler</b> for slot 0. <code>t0</code> and <code>s0</code> are bound together as one pair by <code>SDL_BindGPUFragmentSamplers</code>."],
  [4,7,"<span class='k'>input</span>The UV the vertex shader wrote out, <b>interpolated</b> across the triangle. The semantic (<code>TEXCOORD0</code>) must match the vertex shader’s output."],
  [9,9,"<span class='k'>SV_Target0</span>The return value is written to <b>color target 0</b> of the render pass."],
  [11,11,"<span class='k'>Sample</span><code>Texture.Sample(Sampler, uv)</code> reads the texture at that UV using the sampler’s filter and address mode. It replaces GLSL’s <code>texture(u_texture, uv)</code>."]
],"<span class='k'>shadercross</span>Write HLSL once; <b>SDL_shadercross</b> compiles it to SPIR-V (Vulkan), DXIL (D3D12) or MSL (Metal) for <code>SDL_CreateGPUShader</code>.");
codeTips($("saCode"),$("saTip"),[
  [1,1,"<b>{}</b> zero-initializes. Anything you don’t set is 0 (nearest filtering, repeat addressing)."],
  [2,3,"<span class='k'>filters</span><b>min</b> = texture shrunk (far away), <b>mag</b> = texture stretched (up close). Next slide."],
  [4,4,"<span class='k'>mipmap mode</span>Blend between mip levels (<b>LINEAR</b>) or snap to the nearest one (<b>NEAREST</b>). See the mipmaps slide."],
  [5,7,"<span class='k'>address modes</span>What happens when a UV is outside 0 to 1, per axis. <b>w</b> is for 3D textures and cubemaps."],
  [8,9,"<span class='k'>anisotropy</span>Extra samples for surfaces seen at steep angles. 16 is the usual max."],
  [10,10,"<span class='k'>gotcha</span>With zero-init, <code>max_lod</code> is <b>0</b>, which locks sampling to mip level 0. Set it high so mipmaps are used."],
  [12,12,"Create once at startup, reuse every frame. Release with <code>SDL_ReleaseGPUSampler</code>."]
],"<span class='k'>SDL_GPUSamplerCreateInfo</span>Hover a line to see what it does.");
codeTips($("svCode"),$("svTip"),[
  [1,5,"<span class='k'>b0 · space1</span>Vertex-shader uniforms. Filled each frame with <code>SDL_PushGPUVertexUniformData(cmd, 0, &m, sizeof(m))</code>."],
  [6,6,"The cube’s corner positions, −1 to 1."],
  [7,11,"<b>TexCoord</b> goes to the fragment shader; <b>SV_Position</b> is the clip-space position."],
  [15,15,"A cube vertex’s position <i>is</i> the direction from the center, so it doubles as the <b>cubemap coordinate</b>."],
  [16,16,"<code>(float3x3)View</code> keeps the <b>rotation</b> and drops the translation (like <code>mat3(view)</code> in GLSL). The sky turns with you but never moves."],
  [17,17,"Then project it like any other vertex."],
  [18,18,"<code>.xyww</code> sets z = w, so after the divide depth = <b>1.0</b>, the far plane. With LESS_OR_EQUAL the sky only shows where nothing else was drawn."]
],"Hover a line of the vertex shader.");
codeTips($("sfCode"),$("svTip"),[
  [1,2,"<b>TextureCube</b> in slot 0: the six-layer cube texture and its sampler."],
  [4,7,"Sample the cubemap with the interpolated <b>direction</b>. It doesn’t need to be normalized."]
],"Hover a line of the vertex shader.");
codeTips($("rvCode"),$("rvTip"),[
  [1,7,"<span class='k'>b0 · space1</span>Model, view and projection matrices, plus the camera position."],
  [6,6,"<span class='k'>no inverse()</span>GLSL used <code>inverse(view)[3]</code> to find the camera. HLSL has no <code>inverse()</code>, so pass <b>CameraPosition</b> as a uniform."],
  [10,11,"<span class='k'>TEXCOORD2</span>Attribute <b>location 2</b> is the normal, matching the vertex buffer layout (position 0, UV 1, normal 2)."],
  [16,16,"Vertex position in <b>world space</b>."],
  [17,17,"Normal in world space. <code>(float3x3)Model</code> is fine for uniform scale; use the inverse-transpose for non-uniform scale."],
  [18,18,"The incident vector <b>i</b>: from the camera to this vertex."],
  [20,20,"<b>reflect</b> bounces i off the normal. The result is the direction to look up in the cubemap. (<code>Output</code> is the same struct as the skybox shader.)"],
  [21,21,"The normal MVP transform for the position."]
],"<span class='k'>reflection.vert.hlsl</span>Hover a line. The fragment shader is the same as the skybox’s: sample the cubemap with TexCoord.");

codeTips($("rrCode"),$("rrTip"),[
  [1,8,"<span class='k'>b0 · space1</span>The same matrices and camera position as the reflection shader, plus one new value."],
  [7,7,"<span class='k'>IOR</span>The material’s index of refraction: 1.33 for water, 1.52 for glass, 2.42 for diamond. Push it with the other vertex uniforms."],
  [12,12,"Vertex position in <b>world space</b>."],
  [13,13,"Normal in world space, exactly as in the reflection shader."],
  [14,14,"The incident vector <b>i</b>: from the camera to this vertex."],
  [16,17,"<span class='k'>the one changed line</span><b>refract</b> bends i through the surface instead of bouncing it. Its third argument is the <b class='y'>ratio</b> n₁ / n₂: from air (1.0) into the material, so <code>1.0 / IOR</code>. The result is the direction to look up in the cubemap."],
  [18,18,"The normal MVP transform for the position."]
],"<span class='k'>refraction.vert.hlsl</span>Same as reflection, with one line changed. Hover a line. The fragment shader is still the skybox’s: sample the cubemap with TexCoord.");

/* ---------- filtering: nearest vs linear, see which texels each pixel reads ---------- */
(() => {
  const cv=$("fiCv"), TW=64, TH=48; let T=null, mode="n", zoom=1, grid=false, hover=null, dirty=true, off=null;
  whenLoaded(IM.kitten,()=>{ const c=document.createElement("canvas"); c.width=TW; c.height=TH; const x=c.getContext("2d"); x.imageSmoothingQuality="high"; x.drawImage(IM.kitten,14,12,292,218,0,0,TW,TH); T=x.getImageData(0,0,TW,TH).data; dirty=true; });
  const setMode=tabs($("fiMode"),k=>{ mode=k; dirty=true; });
  const zs=slider("fiZoom",v=>v.toFixed(1)+"×",v=>{ zoom=v; dirty=true; });
  const setGrid=toggle($("fiGrid"),on=>{ grid=on; });
  cv.addEventListener("pointermove",e=>{ hover=localXY(e,cv); }); cv.addEventListener("pointerleave",()=>hover=null);
  const tex=(i,j)=>{ i=clamp(i,0,TW-1); j=clamp(j,0,TH-1); const k=(j*TW+i)*4; return [T[k],T[k+1],T[k+2]]; };
  function geo(){ const w=cv.offsetWidth, h=cv.offsetHeight, dw=Math.min(w-40,(h-40)*TW/TH), dh=dw*TH/TW; return {w,h,dw,dh,ox:(w-dw)/2,oy:(h-dh)/2}; }
  const toUV=(g,x,y)=>[.5+((x-g.ox)/g.dw-.5)/zoom,.5+((y-g.oy)/g.dh-.5)/zoom];
  const toScr=(g,u,v)=>[g.ox+((u-.5)*zoom+.5)*g.dw,g.oy+((v-.5)*zoom+.5)*g.dh];
  function sample(u,v){
    if(mode==="n") return {c:tex(Math.floor(u*TW),Math.floor(v*TH)),taps:[[Math.floor(u*TW),Math.floor(v*TH),1]]};
    const tx=u*TW-.5, ty=v*TH-.5, x0=Math.floor(tx), y0=Math.floor(ty), fx_=tx-x0, fy=ty-y0;
    const taps=[[x0,y0,(1-fx_)*(1-fy)],[x0+1,y0,fx_*(1-fy)],[x0,y0+1,(1-fx_)*fy],[x0+1,y0+1,fx_*fy]], c=[0,0,0];
    for(const [i,j,w] of taps){ const t=tex(i,j); c[0]+=t[0]*w; c[1]+=t[1]*w; c[2]+=t[2]*w; } return {c,taps};
  }
  function bake(){ const g=geo(), W=Math.round(g.w), H=Math.round(g.h); off=off||document.createElement("canvas"); off.width=W; off.height=H;
    const x=off.getContext("2d"), id=x.createImageData(W,H), d=id.data;
    for(let py=0;py<H;py++) for(let px=0;px<W;px++){ const k=(py*W+px)*4; const inside=px>=g.ox&&px<g.ox+g.dw&&py>=g.oy&&py<g.oy+g.dh;
      if(!inside){ d[k]=13; d[k+1]=13; d[k+2]=15; d[k+3]=255; continue; }
      const [u,v]=toUV(g,px+.5,py+.5), c=sample(u,v).c; d[k]=c[0]; d[k+1]=c[1]; d[k+2]=c[2]; d[k+3]=255; }
    x.putImageData(id,0,0); dirty=false; }
  A.filter={
    enter(){ setMode("n"); mode="n"; zs.set(1); setGrid(false); grid=false; hover=null; dirty=true; },
    tick(){
      if(!T) return; if(dirty) bake();
      const x=ctxOf(cv), g=geo(); x.imageSmoothingEnabled=false; x.drawImage(off,0,0,g.w,g.h);
      x.save(); x.beginPath(); x.rect(g.ox,g.oy,g.dw,g.dh); x.clip();
      if(grid){ x.strokeStyle="rgba(243,241,234,.18)"; x.lineWidth=1; x.beginPath();
        for(let i=0;i<=TW;i++){ const [sx]=toScr(g,i/TW,0); x.moveTo(sx,g.oy); x.lineTo(sx,g.oy+g.dh); }
        for(let j=0;j<=TH;j++){ const [,sy]=toScr(g,0,j/TH); x.moveTo(g.ox,sy); x.lineTo(g.ox+g.dw,sy); } x.stroke(); }
      let pv=null;
      if(hover&&hover[0]>g.ox&&hover[0]<g.ox+g.dw&&hover[1]>g.oy&&hover[1]<g.oy+g.dh){
        const [u,v]=toUV(g,hover[0],hover[1]), s=sample(u,v);
        const box=(i,j)=>{ const [a,b]=toScr(g,i/TW,j/TH), [c2,d2]=toScr(g,(i+1)/TW,(j+1)/TH); return [a,b,c2-a,d2-b]; };
        const ctr=(i,j)=>toScr(g,(i+.5)/TW,(j+.5)/TH);
        if(mode==="l"){ // lines from the sample point to each texel center, thicker = more weight
          for(const [i,j,w] of s.taps){ const [cx,cy]=ctr(i,j); x.strokeStyle="rgba(13,13,15,.9)"; x.lineWidth=2+w*5; x.beginPath(); x.moveTo(hover[0],hover[1]); x.lineTo(cx,cy); x.stroke();
            x.strokeStyle=Y; x.lineWidth=.5+w*3.5; x.beginPath(); x.moveTo(hover[0],hover[1]); x.lineTo(cx,cy); x.stroke(); dot(x,cx,cy,3,Y); } }
        for(const [i,j,w] of s.taps){ const [a,b,bw,bh]=box(i,j);
          x.strokeStyle="#0d0d0f"; x.lineWidth=5; x.strokeRect(a,b,bw,bh);
          x.strokeStyle=Y; x.lineWidth=2.5; x.strokeRect(a,b,bw,bh);
          x.fillStyle=`rgba(255,194,14,${mode==="l"?w*.35:.15})`; x.fillRect(a,b,bw,bh); }
        if(mode==="l"){ // weights sit outside the 2x2 block, at its four corners
          const [i0,j0]=s.taps[0], [ga,gb]=toScr(g,i0/TW,j0/TH), [gc,gd]=toScr(g,(i0+2)/TW,(j0+2)/TH);
          s.taps.forEach(([i,j,w])=>{ const r=i>i0, dn=j>j0, lx=r?gc+6:ga-6, ly=dn?gd+18:gb-8;
            x.font='14px "JetBrains Mono",monospace'; const tw=x.measureText(w.toFixed(2)).width;
            x.fillStyle="rgba(13,13,15,.9)"; x.fillRect(r?lx-3:lx-tw-3,ly-15,tw+6,20); label(x,w.toFixed(2),lx,ly,Y,14,r?"left":"right"); }); }
        x.strokeStyle=INK; x.lineWidth=1.5; x.beginPath(); x.moveTo(hover[0]-10,hover[1]); x.lineTo(hover[0]+10,hover[1]); x.moveTo(hover[0],hover[1]-10); x.lineTo(hover[0],hover[1]+10); x.stroke();
        pv={u,v,s};
      }
      x.restore();
      preview(pv);
    }
  };
  // zoomed 3x3 neighborhood around the texel under the mouse
  const pc=$("fiPv");
  function preview(p){
    const x=ctxOf(pc), w=pc.offsetWidth, h=pc.offsetHeight; x.clearRect(0,0,w,h);
    label(x,mode==="n"?"NEAREST":"LINEAR",20,30,MUTE,13);
    if(!p){ label(x,"hover the image to see the texels it samples",20,h/2+6,MUTE,15); return; }
    const {u,v,s}=p, C=Math.floor((h-60)/3), gx=20, gy=44, ci=Math.floor(u*TW), cj=Math.floor(v*TH);
    x.save(); x.beginPath(); x.rect(gx,gy,C*3,C*3); x.clip();
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ const t=tex(ci+di,cj+dj); x.fillStyle=`rgb(${t.join(",")})`; x.fillRect(gx+(di+1)*C,gy+(dj+1)*C,C,C); }
    x.strokeStyle="rgba(13,13,15,.6)"; x.lineWidth=1; for(let k=1;k<3;k++){ x.beginPath(); x.moveTo(gx+k*C,gy); x.lineTo(gx+k*C,gy+3*C); x.moveTo(gx,gy+k*C); x.lineTo(gx+3*C,gy+k*C); x.stroke(); }
    const px=gx+(u*TW-(ci-1))*C, py=gy+(v*TH-(cj-1))*C, cell=(i,j)=>[gx+(i-ci+1)*C,gy+(j-cj+1)*C];
    if(mode==="l") for(const [i,j,wt] of s.taps){ const [a,b]=cell(i,j); x.strokeStyle="rgba(13,13,15,.9)"; x.lineWidth=2+wt*5; x.beginPath(); x.moveTo(px,py); x.lineTo(a+C/2,b+C/2); x.stroke();
      x.strokeStyle=Y; x.lineWidth=.5+wt*3.5; x.beginPath(); x.moveTo(px,py); x.lineTo(a+C/2,b+C/2); x.stroke(); }
    for(const [i,j,wt] of s.taps){ const [a,b]=cell(i,j);
      x.strokeStyle="#0d0d0f"; x.lineWidth=5; x.strokeRect(a+2.5,b+2.5,C-5,C-5); x.strokeStyle=Y; x.lineWidth=2.5; x.strokeRect(a+2.5,b+2.5,C-5,C-5);
      const tx=mode==="l"?wt.toFixed(2):"1.00"; x.font='13px "JetBrains Mono",monospace'; const tw=x.measureText(tx).width;
      x.fillStyle="rgba(13,13,15,.85)"; x.fillRect(a+C/2-tw/2-4,b+C-24,tw+8,18); label(x,tx,a+C/2,b+C-10,Y,13,"center"); }
    dot(x,px,py,5,INK,"#0d0d0f");
    x.restore(); x.strokeStyle=LINE; x.lineWidth=1; x.strokeRect(gx,gy,C*3,C*3);
    // numbers + result
    const rx=gx+C*3+24, col=`rgb(${s.c.map(Math.round).join(",")})`;
    label(x,"uv",rx,gy+16,MUTE,13); label(x,`(${u.toFixed(3)}, ${v.toFixed(3)})`,rx,gy+36,Y,16);
    label(x,"texel",rx,gy+64,MUTE,13); label(x,`(${(u*TW).toFixed(2)}, ${(v*TH).toFixed(2)})`,rx,gy+84,INK,16);
    label(x,mode==="n"?"result: 1 texel":"result: 4 blended",rx,gy+112,MUTE,13);
    x.fillStyle=col; x.beginPath(); x.roundRect(rx,gy+122,54,C*3-122,8); x.fill(); x.strokeStyle=LINE; x.stroke();
  }
})();
/* ---------- mipmaps: a floor stretching into the distance ---------- */
(() => {
  const cv=$("mpCv"), cap=$("mpCap"); let mode="off", aniso=false, moving=true, off=0;
  const setMode=tabs($("mpMode"),k=>mode=k);
  const setA=toggle($("mpAniso"),on=>aniso=on), setM=toggle($("mpMove"),on=>moving=on);
  if(!GL||!GL.AN) $("mpAniso").disabled=true;
  A.mip={
    enter(){ mode="off"; setMode("off"); aniso=false; setA(false); moving=true; setM(true); off=0; },
    tick(dt){
      if(!GL||!P.tex) return noGL(cv);
      if(moving) off+=dt*.0006;
      const t=mode==="lv"?TX.levels:TX.bricks; if(!t.ready) return;
      GL.render(cv,(w,h)=>{
        const VP=M4.mul(M4.persp(.9,w/h,.05,300),M4.lookAt([0,1.1,2],[0,.55,-6],[0,1,0]));
        const s=mode==="off"?(aniso?SM.linA:SM.lin):(aniso?SM.mipA:SM.mip);
        GL.bind(0,GL.gl.TEXTURE_2D,t.t,s);
        GL.use(P.tex,{uMVP:VP,uTiling:[60,100],uOffset:[0,-off],uTex:0,uMode:0,uOutline:0});
        GL.draw(MESH.floor);
      });
      cap.textContent=(mode==="off"?"min_filter LINEAR · no mip levels":"mipmap_mode LINEAR · "+(mode==="lv"?"red = level 0 (full size), then orange, yellow, green, blue…":"all levels"))+(aniso?" · 16× aniso":"");
    }
  };
})();

/* ---------- address modes ---------- */
(() => {
  const cv=$("wrCv"), code=$("wrCode"); let mode="r", range=3;
  const N={r:"REPEAT",m:"MIRRORED_REPEAT",c:"CLAMP_TO_EDGE"};
  const show=()=>setCode(code,`s.address_mode_u = SDL_GPU_SAMPLERADDRESSMODE_${N[mode]};\ns.address_mode_v = SDL_GPU_SAMPLERADDRESSMODE_${N[mode]};`);
  const setMode=tabs($("wrMode"),k=>{ mode=k; show(); });
  const rs=slider("wrRange",v=>`${fmt(.5-v/2)} … ${fmt(.5+v/2)}`,v=>range=v);
  A.wrap={
    enter(){ mode="r"; setMode("r"); show(); rs.set(3); },
    tick(){
      if(!GL||!P.tex) return noGL(cv); if(!TX.kitten.ready) return;
      GL.render(cv,(w,h)=>{ const a=w/h, s=.92;
        GL.bind(0,GL.gl.TEXTURE_2D,TX.kitten.t,SM[mode]);
        GL.use(P.tex,{uMVP:M4.S(s*Math.min(1,1/a),s*Math.min(1,a),1),uTiling:[range,range],uOffset:[.5-range/2,.5-range/2],uTex:0,uMode:0,uOutline:1});
        GL.draw(MESH.quad); });
    }
  };
})();

/* ---------- tiling and offset ---------- */
(() => {
  const cv=$("tlCv"), code=$("tlCode"); let scroll=false, ox=0; // ox kept here: the slider snaps to .01 steps, too coarse for per-frame scrolling
  const S={}; const upd=()=>setCode(code,`float2 uv = input.TexCoord * Tiling + Offset;\n// Tiling = (${fmt(S.tx.get(),1)}, ${fmt(S.ty.get(),1)})   Offset = (${ox.toFixed(2)}, ${S.oy.get().toFixed(2)})`);
  S.tx=slider("tlTx",v=>v.toFixed(1),upd); S.ty=slider("tlTy",v=>v.toFixed(1),upd); S.ox=slider("tlOx",v=>v.toFixed(2),v=>{ ox=v; upd(); }); S.oy=slider("tlOy",v=>v.toFixed(2),upd);
  const setS=toggle($("tlScroll"),on=>scroll=on);
  const reset=()=>{ S.tx.set(1); S.ty.set(1); S.ox.set(0); S.oy.set(0); scroll=false; setS(false); };
  $("tlReset").onclick=reset;
  A.tiling={
    enter(){ reset(); upd(); },
    tick(dt){
      if(scroll){ ox+=dt*.00015; if(ox>1) ox-=2; $("tlOx").value=ox; $("tlOxO").textContent=ox.toFixed(2); upd(); }
      if(!GL||!P.tex) return noGL(cv); if(!TX.bricks.ready) return;
      GL.render(cv,(w,h)=>{ GL.bind(0,GL.gl.TEXTURE_2D,TX.bricks.t,SM.r);
        GL.use(P.tex,{uMVP:M4.S(.9*h/w,.9,1),uTiling:[S.tx.get(),S.ty.get()],uOffset:[ox,S.oy.get()],uTex:0,uMode:0,uOutline:0}); GL.draw(MESH.quad); });
    }
  };
})();

/* ---------- multi-texture ---------- */
(() => {
  const cv=$("muCv"), code=$("muCode"); let mode="mul";
  const C={mul:["a * b","×"],lerp:["lerp(a, b, Blend)","lerp"],add:["a + b * 0.6","+"]};
  const show=()=>{ setCode(code,`float4 a = Texture1.Sample(Sampler1, uv);\nfloat4 b = Texture2.Sample(Sampler2, uv);\nreturn ${C[mode][0]};`); $("muOp").textContent=C[mode][1]; $("muMixRow").style.visibility=mode==="lerp"?"visible":"hidden"; };
  const setMode=tabs($("muMode"),k=>{ mode=k; show(); });
  const mx=slider("muMix",v=>v.toFixed(2));
  A.multi={
    enter(){ mode="mul"; setMode("mul"); mx.set(.5); show(); },
    tick(){
      if(!GL||!P.tex) return noGL(cv); if(!TX.bricks.ready||!TX.grass.ready) return;
      GL.render(cv,(w,h)=>{ GL.bind(0,GL.gl.TEXTURE_2D,TX.bricks.t,SM.r); GL.bind(1,GL.gl.TEXTURE_2D,TX.grass.t,SM.r);
        GL.use(P.tex,{uMVP:M4.S(.92*h/w*1.6,.92,1),uTiling:[1.6,1],uOffset:[0,0],uTex:0,uTex2:1,uMode:{mul:1,lerp:2,add:3}[mode],uMix:mx.get(),uOutline:0}); GL.draw(MESH.quad); });
    }
  };
})();

/* ---------- material maps: one lit-model renderer for albedo, specular and emissive ---------- */
function litDemo(cv,opt){
  const st=orbit(cv,{yaw:.6,pitch:-.35});
  return {
    reset(){ st.yaw=.6; st.pitch=-.35; },
    draw(now,u){
      if(!GL||!P.lit) return noGL(cv);
      const L=now*.0006;
      GL.render(cv,(w,h)=>{
        const eye=[0,0,4.2], VP=M4.mul(M4.persp(.75,w/h,.1,50),M4.lookAt(eye,[0,0,0],[0,1,0]));
        const model=M4.chain(M4.RX(st.pitch),M4.RY(st.yaw),M4.S(opt.scale||1));
        const lp=[Math.cos(L)*2.6,1.3,3+Math.sin(L)*.6];
        GL.bind(0,GL.gl.TEXTURE_2D,u.alb.t,SM.mipA); GL.bind(1,GL.gl.TEXTURE_2D,(u.spec||u.alb).t,SM.mipA); GL.bind(2,GL.gl.TEXTURE_2D,(u.emis||u.alb).t,SM.mipA);
        GL.use(P.lit,{uModel:model,uVP:VP,uTiling:opt.tiling||[1,1],uAlb:0,uSpec:1,uEmis:2,uUseAlb:u.useAlb??1,uSpecMode:u.specMode??1,uUseEmis:u.emis?1:0,uEmisS:u.emisS??0,
          uLightPos:lp,uLightCol:u.lightCol||[1,1,1],uLightI:u.lightI??1,uCam:eye,uShine:u.shine||40,uAmb:.16});
        GL.draw(MESH[opt.mesh]);
        // the light
        GL.use(P.flat,{uMVP:M4.chain(VP,M4.T(...lp),M4.S(.08)),uColor:[...(u.lightCol||[1,1,1]).map(c=>c*Math.min(1,(u.lightI??1)+.15)),1]}); GL.draw(MESH.sphere);
      });
    }
  };
}
(() => {
  const D=litDemo($("alCv"),{mesh:"cube",scale:.85}), LC={w:[1,1,1],o:[1,.62,.3],b:[.45,.65,1]}; let lc="w", useAlb=true;
  const setL=tabs($("alLight"),k=>lc=k), setT=toggle($("alTex"),on=>{ useAlb=on; $("alTex").textContent=on?"albedo map on":"albedo map off"; });
  A.albedo={ enter(){ lc="w"; setL("w"); useAlb=true; setT(true); $("alTex").textContent="albedo map on"; D.reset(); },
    tick(dt,now){ if(TX.bricks.ready) D.draw(now,{alb:TX.bricks,useAlb:useAlb?1:0,specMode:0,lightCol:LC[lc]}); } };
})();
(() => {
  const D=litDemo($("spCv"),{mesh:"sphere",scale:1.25,tiling:[3,1.5]}), cap=$("spCap"); let m=2;
  const CAP=["no specular: looks like dry clay","same shine everywhere: looks like plastic","specular map: bricks shine, mortar stays dull","the specular map itself (white = shiny)"];
  const setM=tabs($("spMode"),k=>m=+k);
  A.specular={ enter(){ m=0; setM("0"); D.reset(); },
    tick(dt,now){ cap.textContent=CAP[m]; if(TX.bricks.ready&&TX.spec.ready) D.draw(now,{alb:TX.bricks,spec:TX.spec,specMode:m,shine:28}); } };
})();
(() => {
  const D=litDemo($("emCv"),{mesh:"cube",scale:.85});
  const li=slider("emLight",v=>v.toFixed(2)), es=slider("emStr",v=>v.toFixed(2));
  A.emissive={ enter(){ li.set(1); es.set(1.5); D.reset(); },
    tick(dt,now){ if(TX.scifi.ready&&TX.scifiE.ready) D.draw(now,{alb:TX.scifi,emis:TX.scifiE,emisS:es.get(),lightI:li.get(),specMode:1,shine:60}); } };
})();

/* ---------- cube net that folds into a cube (CSS 3D) ---------- */
(() => {
  const root=$("cbRoot"), box=$("cbBox"), btn=$("cbFold"), S=150;
  const mk=(k,parent,left,top,origin)=>{ const f=FACES.find(q=>q.k===k), d=document.createElement("div"); d.className="face";
    d.style.left=left+"px"; d.style.top=top+"px"; d.style.transformOrigin=origin; d.style.backgroundPosition=`${-f.cell[0]*S}px ${-f.cell[1]*S}px`;
    d.innerHTML=`<span class="lab">${f.axis} · ${f.layer}</span>`; parent.appendChild(d); return d; };
  const front=mk("nz",root,0,0,"center"), left=mk("nx",front,-S,0,"right center"), right=mk("px",front,S,0,"left center"),
        top=mk("py",front,0,-S,"center bottom"), bottom=mk("ny",front,0,S,"center top"), back=mk("pz",right,S,0,"left center");
  let t=0, target=0, st={yaw:0,pitch:0};
  orbit(box,st,{k:.5,minP:-80,maxP:80});
  btn.onclick=()=>{ target=target?0:1; btn.textContent=target?"unfold":"fold into a cube"; btn.classList.toggle("on",!!target); if(target){ st.yaw=-35; st.pitch=20; } else { st.yaw=0; st.pitch=0; } };
  function apply(){ const a=90*ease(t);
    left.style.transform=`rotateY(${-a}deg)`; right.style.transform=`rotateY(${a}deg)`; back.style.transform=`rotateY(${a}deg)`;
    top.style.transform=`rotateX(${a}deg)`; bottom.style.transform=`rotateX(${-a}deg)`;
    const k=ease(t); root.style.transform=`scale(${1.15+.45*k}) translateX(${-75*(1-k)}px) rotateX(${-st.pitch}deg) rotateY(${st.yaw}deg) translateZ(${75*k}px)`; }
  A.cubemap={ enter(){ t=0; target=0; st.yaw=0; st.pitch=0; btn.textContent="fold into a cube"; btn.classList.remove("on"); apply(); },
    tick(dt){ t=clamp(t+(target?1:-1)*dt/1100,0,1); apply(); } };
})();

/* ---------- cube sampling: which face does a direction hit? ---------- */
(() => {
  const svg=$("csSvg"), read=$("csRead"), C=140, OX=100, OY=80;
  svgEl("image",{href:"{{IMG:cube-cross.png}}",x:OX,y:OY,width:C*4,height:C*3,opacity:.9},svg);
  const outl=FACES.map(f=>svgEl("rect",{x:OX+f.cell[0]*C,y:OY+f.cell[1]*C,width:C,height:C,fill:"none",stroke:"rgba(255,194,14,.25)","stroke-width":2},svg));
  FACES.forEach(f=>textSvg(svg,`${f.axis} · ${f.layer}`,OX+f.cell[0]*C+8,OY+f.cell[1]*C+C-10,INK,14,"start",600));
  const hi=svgEl("rect",{width:C,height:C,fill:"rgba(255,194,14,.12)",stroke:Y,"stroke-width":4},svg);
  const dt_=svgEl("circle",{r:10,fill:Y,stroke:"#0d0d0f","stroke-width":3},svg);
  const ring=svgEl("circle",{r:20,fill:"none",stroke:Y,"stroke-width":2,opacity:.6},svg);
  textSvg(svg,"camera looks down −Z (glm’s default), so front = −Z",380,OY+C*3+50,MUTE,15,"middle");
  // 3D view of the direction inside a cube, in the empty top-left cell of the net
  const g3=svgEl("g",{},svg), CX=OX+18, CY=OY+44, SZ=56, YA=-.6, PA=.42;
  const P3=([x,y,z])=>{ const x1=x*Math.cos(YA)+z*Math.sin(YA), z1=-x*Math.sin(YA)+z*Math.cos(YA), y2=y*Math.cos(PA)-z1*Math.sin(PA), z2=y*Math.sin(PA)+z1*Math.cos(PA); return [CX+x1*SZ,CY-y2*SZ,z2]; };
  const CORN=[]; for(let i=0;i<8;i++) CORN.push([i&1?1:-1,i&2?1:-1,i&4?1:-1]);
  const EDGES=[]; for(let i=0;i<8;i++) for(const b of [1,2,4]) if(!(i&b)) EDGES.push([i,i|b]);
  function draw3(q){ g3.innerHTML=""; const P=CORN.map(P3), far=P.reduce((m,p,i)=>p[2]<P[m][2]?i:m,0), f=q.f;
    // the face the direction hits
    const fc=CORN.map((c,i)=>i).filter(i=>CORN[i][q.major]===Math.sign(f.n[q.major])), ord=[0,1,3,2].map(j=>fc[j]);
    svgEl("polygon",{points:ord.map(i=>P[i][0]+","+P[i][1]).join(" "),fill:"rgba(255,194,14,.16)",stroke:Y,"stroke-width":1.5},g3);
    EDGES.forEach(([a,b])=>{ const hid=a===far||b===far; svgEl("line",{x1:P[a][0],y1:P[a][1],x2:P[b][0],y2:P[b][1],stroke:hid?"rgba(155,152,143,.45)":MUTE,"stroke-width":1.5,"stroke-dasharray":hid?"3 4":""},g3); });
    // axes
    [[1,0,0,RED,"+X"],[0,1,0,GREEN,"+Y"],[0,0,1,BLUE,"+Z"]].forEach(([x,y,z,c,t])=>{ const a=P3([0,0,0]), b=P3([x*.55,y*.55,z*.55]), e=P3([x*1.42,y*1.42,z*1.42]);
      svgEl("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:c,"stroke-width":2,opacity:.8},g3); textSvg(g3,t,e[0],e[1]+5,c,13,"middle",700); });
    // the direction, out to where it meets the cube
    const dd=d.every(v=>Math.abs(v)<1e-3)?[0,0,-1]:d, o=P3([0,0,0]), m=Math.max(...dd.map(Math.abs)), t=P3(dd.map(v=>v/m));
    arrowSvg(g3,o[0],o[1],t[0],t[1],Y,4); svgEl("circle",{cx:t[0],cy:t[1],r:5,fill:Y,stroke:"#0d0d0f","stroke-width":2},g3); svgEl("circle",{cx:o[0],cy:o[1],r:3.5,fill:INK},g3);
    textSvg(g3,"direction",CX,22,MUTE,14,"middle"); }
  let d=[.3,.2,-1];
  const S=["X","Y","Z"].map((a,i)=>slider("cs"+a,v=>fx(v),v=>{ d[i]=v; upd(); }));
  function upd(){ const q=faceOf(d.every(v=>Math.abs(v)<1e-3)?[0,0,-1]:d), f=q.f, x=OX+(f.cell[0]+q.px)*C, y=OY+(f.cell[1]+q.py)*C;
    hi.setAttribute("x",OX+f.cell[0]*C); hi.setAttribute("y",OY+f.cell[1]*C);
    dt_.setAttribute("cx",x); dt_.setAttribute("cy",y); ring.setAttribute("cx",x); ring.setAttribute("cy",y); draw3(q);
    read.innerHTML=`direction = (${d.map(v=>fx(v)).join(", ")})<br>largest: |${"xyz"[q.major]}| = ${Math.abs(d[q.major]).toFixed(2)} → <b>${f.axis} ${f.name}</b> · layer ${f.layer}<br>spot on that face = (${q.px.toFixed(2)}, ${q.py.toFixed(2)})`; }
  svg.addEventListener("pointerdown",e=>{ const [mx,my]=svgXY(e,svg), cx=Math.floor((mx-OX)/C), cy=Math.floor((my-OY)/C), f=FACES.find(q=>q.cell[0]===cx&&q.cell[1]===cy); if(!f) return;
    const px=(mx-OX)/C-cx, py=(my-OY)/C-cy, u=px*2-1, v=1-py*2; const p=[0,1,2].map(i=>f.n[i]+f.r[i]*u+f.u[i]*v); p.forEach((val,i)=>S[i].set(+val.toFixed(2))); });
  A.cubesample={ enter(){ S[0].set(.3); S[1].set(.2); S[2].set(-1); } };
})();

/* ---------- skybox demo ---------- */
(() => {
  const cv=$("skCv"), cap=$("skCap"); let view="rot", edges=false, depthW=false;
  const st=orbit(cv,{yaw:0,pitch:0},{k:.006});
  const setV=tabs($("skView"),k=>view=k);
  const wk=slider("skWalk",v=>fx(v,2));
  const setE=toggle($("skEdges"),on=>edges=on), setD=toggle($("skDepth"),on=>{ depthW=on; $("skDepth").textContent=on?"depth write on":"depth write off"; });
  const crates=[[0,0,-5],[2.6,-.6,-4.2],[-2.8,.3,-4.6],[4.5,0,1],[-4.6,-.4,.5],[1,.2,5]];
  A.skydemo={
    enter(){ view="rot"; setV("rot"); wk.set(0); edges=false; setE(false); depthW=false; setD(false); $("skDepth").textContent="depth write off"; st.yaw=0; st.pitch=0; },
    tick(dt,now){
      if(!GL||!P.sky) return noGL(cv); if(!TX.sky.ready) return;
      const gl=GL.gl, walk=wk.get();
      GL.render(cv,(w,h)=>{
        const proj=M4.persp(1.1,w/h,.05,100), V=M4.chain(M4.RX(-st.pitch),M4.RY(st.yaw),M4.T(-walk,0,0));
        const skyVP=M4.mul(proj,view==="rot"?M4.rotOnly(V):V);
        gl.depthMask(depthW); GL.bind(0,gl.TEXTURE_CUBE_MAP,TX.sky.t,SM.mip); GL.use(P.sky,{uVP:skyVP,uCube:0}); GL.draw(MESH.cube); gl.depthMask(true);
        if(edges){ GL.use(P.flat,{uMVP:skyVP,uColor:[1,.76,.05,1]}); GL.draw(MESH.edges); }
        if(TX.bricks.ready){ const VP=M4.mul(proj,V);
          GL.bind(1,gl.TEXTURE_2D,TX.bricks.t,SM.mipA);
          crates.forEach((p,i)=>{ GL.use(P.lit,{uModel:M4.chain(M4.T(...p),M4.RY(i*.7+now*.0003),M4.S(.5)),uVP:VP,uTiling:[1,1],uAlb:1,uSpec:1,uEmis:1,uUseAlb:1,uSpecMode:0,uUseEmis:0,
            uLightPos:[3,6,2],uLightCol:[1,.97,.9],uLightI:1,uCam:[walk,0,0],uShine:20,uAmb:.35}); GL.draw(MESH.cube); }); }
      });
      cap.textContent=(view==="rot"?"sky: projection × rotation only":"sky: projection × full view (translation too)")+" · camera x = "+fx(walk);
    }
  };
})();

/* ---------- skybox steps ---------- */
(() => {
  const pre=$("ssCode"), lis=[...$("ssSteps").children], R=[[[12,13]],[[15,15]],[[2,5],[8,8]],[[6,7]],[[10,15]],[[17,18]]]; let k=0;
  function show(){ hlLines(pre,R[k]); lis.forEach((l,i)=>{ l.classList.toggle("on",i===k); l.classList.toggle("done",i<k); }); }
  A.skysteps={ enter(d){ k=d<0?5:0; show(); }, step(){ if(k>=5) return false; k++; show(); return true; }, back(){ if(k<=0) return false; k--; show(); return true; } };
})();

/* ---------- reflect: build r = i − 2n(n·i) ---------- */
(() => {
  const svg=$("rfSvg"), lines=[...$("rfLines").children], key=$("rfKey"), Px=380, Py=430, L=210;
  let k=0, ang=-.75;  // angle of i measured from straight down
  const g=svgEl("g",{},svg);
  svg.addEventListener("pointerdown",e=>{ svg.setPointerCapture(e.pointerId); svg._drag=true; move(e); });
  svg.addEventListener("pointermove",e=>{ if(svg._drag) move(e); });
  svg.addEventListener("pointerup",()=>svg._drag=false);
  function move(e){ const [mx,my]=svgXY(e,svg); if(my>Py-20) return; ang=clamp(Math.atan2(Px-mx,Py-my)*-1,-1.35,1.35); draw(); }
  function draw(){
    g.innerHTML="";
    svgEl("rect",{x:0,y:Py,width:760,height:620-Py,fill:"rgba(106,184,255,.06)"},g);
    svgEl("line",{x1:30,y1:Py,x2:730,y2:Py,stroke:MUTE,"stroke-width":3},g); textSvg(g,"surface",40,Py+30,MUTE,15);
    const ix=Math.sin(-ang), iy=-Math.cos(ang);       // i in math coords (y up), pointing down into the surface
    const S=[Px-ix*L,Py+iy*L];                          // tail of i (svg coords: y down → minus)
    const dn=iy;                                        // dot(n, i) with n = (0, 1)
    // i
    arrowSvg(g,S[0],S[1],Px,Py,BLUE,5); textSvg(g,"i",(S[0]+Px)/2-22,(S[1]+Py)/2,BLUE,26,"middle",700);
    svgEl("circle",{cx:S[0],cy:S[1],r:12,fill:BLUE,opacity:.35,style:"cursor:grab"},g);
    // n
    arrowSvg(g,Px,Py,Px,Py-L,GREEN,5); textSvg(g,"n",Px+16,Py-L+10,GREEN,26,"start",700);
    // n·dot(n,i): from the origin along the dotted copy of i, down into the surface; a dashed line drops to the copy's tip
    if(k>=1){ const Dy=Py-dn*L; arrowSvg(g,Px,Py,Px,Dy,GREEN,3,"8 6"); textSvg(g,`n·dot(n,i) = ${fx(dn)}`,Px+(ix>0?-14:14),(Py+Dy)/2+6,GREEN,16,ix>0?"end":"start");
      svgEl("line",{x1:Px,y1:Dy,x2:Px+ix*L,y2:Dy,stroke:BLUE,"stroke-width":2,"stroke-dasharray":"4 6",opacity:.6},g); }
    if(k>=2){ arrowSvg(g,Px,Py,Px,Py+2*dn*L,AMBER,4); textSvg(g,"−n·dot(n,i)·2",Px+14,Py+2*dn*L+18,AMBER,16); }
    // i copied to start at the origin (always shown); the amber push is added tip-to-tail once r appears
    const Tx=Px+ix*L, Ty=Py-iy*L, faint=svgEl("g",{opacity:.4},g); arrowSvg(faint,Px,Py,Tx,Ty,BLUE,3,"6 6");
    textSvg(g,"i",(Px+Tx)/2+(ix>0?16:-16),(Py+Ty)/2+6,BLUE,20,"middle",700).setAttribute("opacity",.55);
    if(k>=3){ const rx=ix, ry=-iy; arrowSvg(faint,Tx,Ty,Tx,Ty+2*dn*L,AMBER,3,"6 6");
      arrowSvg(g,Px,Py,Px+rx*L,Py-ry*L,Y,6); textSvg(g,"r",Px+rx*L*.55+(rx>0?18:-18),Py-ry*L*.55,Y,28,"middle",700);
      svgEl("line",{x1:S[0],y1:S[1],x2:Px+ix*L,y2:S[1],stroke:Y,"stroke-width":1.5,"stroke-dasharray":"3 6",opacity:.5},g);
      const th=Math.abs(ang), R=70, a1=-Math.PI/2, sgn=ix>0?-1:1;
      const arc=(a,b,c)=>svgEl("path",{d:`M${Px+R*Math.cos(a)},${Py+R*Math.sin(a)} A${R},${R} 0 0 ${b>a?1:0} ${Px+R*Math.cos(b)},${Py+R*Math.sin(b)}`,fill:"none",stroke:c,"stroke-width":2.5},g);
      arc(a1,a1+sgn*th,BLUE); arc(a1,a1-sgn*th,Y);
      textSvg(g,`θ = ${(th*180/Math.PI).toFixed(0)}°`,Px,Py-R-16,INK,17,"middle"); }
    lines.forEach((l,i)=>{ l.classList.toggle("on",i<k); l.classList.toggle("cur",i===k-1); });
    key.classList.toggle("on",k>=3);
  }
  A.reflect={ enter(d){ k=d<0?3:0; ang=-.75; draw(); }, step(){ if(k>=3) return false; k++; draw(); return true; }, back(){ if(k<=0) return false; k--; draw(); return true; } };
})();

/* ---------- reflection in 3D: follow the view ray off the model to the cube ---------- */
(() => {
  const cv=$("r3Cv"), cap=$("r3Cap"), read=$("r3Read"), lis=[...$("r3Steps").children], B=2.6, E=[0,.45,2.05];   // cube half-size, the camera in the scene
  const st=orbit(cv,{yaw:1.25,pitch:-.25},{k:.006}); let k=0, aim=[.35,.25], last="";
  const sx=slider("r3X",v=>fx(v),v=>aim[0]=v), sy=slider("r3Y",v=>fx(v),v=>aim[1]=v);
  // colors for the readout swatch, read from the same cross image the cubemap is built from
  let sky=null; whenLoaded(IM.sky,()=>{ try{ const c=document.createElement("canvas"); c.width=IM.sky.naturalWidth; c.height=IM.sky.naturalHeight; const x=c.getContext("2d"); x.drawImage(IM.sky,0,0); sky={d:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height}; }catch(e){} });
  function skyCol(q){ if(!sky) return "#888"; const W=Math.floor(sky.w/4), H=Math.floor(sky.h/3), px=Math.min(W-1,Math.floor(q.px*W))+q.f.cell[0]*W, py=Math.min(H-1,Math.floor(q.py*H))+q.f.cell[1]*H, i=(py*sky.w+px)*4; return `rgb(${sky.d[i]},${sky.d[i+1]},${sky.d[i+2]})`; }
  const add=(a,b)=>a.map((v,i)=>v+b[i]), sc=(a,s)=>a.map(v=>v*s), lerp3=(a,b,t)=>add(a,sc(V3.sub(b,a),t));
  function hitSphere(o,d){ const b=V3.dot(o,d), c=V3.dot(o,o)-1, h=b*b-c; if(h<0) return -1; const t=-b-Math.sqrt(h); return t>1e-4?t:-1; }   // unit sphere at the origin
  function toWall(o,d){ let t=1e9; for(let i=0;i<3;i++) if(Math.abs(d[i])>1e-6) t=Math.min(t,((d[i]>0?B:-B)-o[i])/d[i]); return add(o,sc(d,t)); }
  function trace(){ const d=V3.norm(V3.sub([aim[0]*1.25,aim[1]*1.25,0],E)), t=hitSphere(E,d);
    if(t<0) return {d,miss:true,Q:toWall(E,d),C:toWall([0,0,0],d),look:d};
    const P=add(E,sc(d,t)), n=P, r=V3.sub(d,sc(n,2*V3.dot(n,d))); return {d,P,n,r,Q:toWall(P,r),C:toWall([0,0,0],r),look:r}; }
  function show(){ lis.forEach((l,i)=>{ l.classList.toggle("on",i===k); l.classList.toggle("done",i<k); }); last=""; }
  function readout(T){ const v=a=>`(${a.map(n=>fx(n)).join(", ")})`, dash=`<span class="muted">—</span>`, q=faceOf(T.look);
    const sw=`<span style="display:inline-block;width:18px;height:18px;border-radius:4px;vertical-align:-3px;background:${skyCol(q)};border:1px solid rgba(255,255,255,.3)"></span> <b>${q.f.axis} ${q.f.name}</b> · layer ${q.f.layer} · (${q.px.toFixed(2)}, ${q.py.toFixed(2)})`;
    const L=T.miss?[`<span style="color:var(--blue)">i = ${v(T.d)}</span>`,`<span class="muted">misses the model: sees the sky directly</span>`,dash,k>=3?sw:dash]
      :[`<span style="color:var(--blue)">i = ${v(T.d)}</span>`,k>=1?`<span style="color:var(--green)">n = ${v(T.n)}</span>`:dash,k>=2?`<span style="color:var(--y)">r = ${v(T.r)}</span>`:dash,k>=3?sw:dash];
    const h=L.join("<br>"); if(h!==last){ read.innerHTML=h; last=h; } }
  function overlay(VP,eye,T){ const x=ctxOf(cv), W=cv.offsetWidth, H=cv.offsetHeight, m=VP;
    const S=p=>{ const X=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], Yc=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]; return [(X/w*.5+.5)*W,(.5-Yc/w*.5)*H]; };
    const hidden=p=>{ const v=V3.sub(p,eye), l=Math.hypot(...v), t=hitSphere(eye,sc(v,1/l)); return t>0&&t<l-1e-3; };   // behind the sphere, as seen from the orbit camera
    function ray(a,b,col,w,dash,arrow=true){ const N=60; x.strokeStyle=col; x.fillStyle=col; x.lineWidth=w; x.lineCap=dash?"butt":"round"; x.setLineDash(dash||[]); let off=0;
      for(let j=0;j<N;j++){ const s0=S(lerp3(a,b,j/N)), s1=S(lerp3(a,b,(j+1)/N)); x.globalAlpha=hidden(lerp3(a,b,(j+.5)/N))?.2:1; x.lineDashOffset=-off; x.beginPath(); x.moveTo(...s0); x.lineTo(...s1); x.stroke(); off+=Math.hypot(s1[0]-s0[0],s1[1]-s0[1]); }
      x.setLineDash([]); x.lineDashOffset=0;
      if(arrow){ const s0=S(lerp3(a,b,.97)), s1=S(b), an=Math.atan2(s1[1]-s0[1],s1[0]-s0[0]), hd=16; x.globalAlpha=hidden(b)?.25:1;
        x.beginPath(); x.moveTo(...s1); x.lineTo(s1[0]-Math.cos(an-.4)*hd,s1[1]-Math.sin(an-.4)*hd); x.lineTo(s1[0]-Math.cos(an+.4)*hd,s1[1]-Math.sin(an+.4)*hd); x.closePath(); x.fill(); }
      x.globalAlpha=1; }
    const ring=(p,col,r=11)=>{ const s=S(p); x.globalAlpha=hidden(p)?.3:1; dot(x,s[0],s[1],r,null,col); dot(x,s[0],s[1],4,col); x.globalAlpha=1; };
    const tag=(p,t,col,dx=14,dy=-10)=>{ const s=S(p); x.globalAlpha=hidden(p)?.4:1; label(x,t,s[0]+dx,s[1]+dy,col,18,dx<0?"right":"left"); x.globalAlpha=1; };
    // the camera in the scene
    const e=S(E); dot(x,e[0],e[1],9,INK); tag(E,"camera",INK,14,22);
    if(T.miss){ ray(E,T.Q,BLUE,4); tag(lerp3(E,T.Q,.5),"i",BLUE); ring(T.Q,BLUE); }
    else { ray(E,T.P,BLUE,4); tag(lerp3(E,T.P,.55),"i",BLUE); const sp=S(T.P); dot(x,sp[0],sp[1],5,INK);
      if(k>=1){ ray(T.P,add(T.P,sc(T.n,1.1)),GREEN,4); tag(add(T.P,sc(T.n,1.1)),"n",GREEN); }
      if(k>=2){ ray(T.P,T.Q,Y,4); tag(lerp3(T.P,T.Q,.6),"r",Y); ring(T.Q,k>=3?MUTE:Y); } }
    if(k>=3){ const q=faceOf(T.look), f=q.f, c=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>S([0,1,2].map(i=>(f.n[i]+f.r[i]*u+f.u[i]*v)*B)));
      x.fillStyle="rgba(255,194,14,.08)"; x.strokeStyle=Y; x.lineWidth=2.5; x.beginPath(); c.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p)); x.closePath(); x.fill(); x.stroke();
      ray([0,0,0],T.C,AMBER,3,[8,8]); ring(T.C,Y,13); tag(T.C,"sampled",Y); }
  }
  A.reflect3d={ enter(d){ k=d<0?3:0; st.yaw=1.25; st.pitch=-.25; st.moved=false; sx.set(.35); sy.set(.25); show(); },
    step(){ if(k>=3) return false; k++; show(); return true; }, back(){ if(k<=0) return false; k--; show(); return true; },
    tick(dt){ if(!GL||!P.box) return noGL(cv); if(!TX.sky.ready) return; if(!st.moved) st.yaw+=dt*.00008;
      const gl=GL.gl, R=13, eye=[Math.sin(st.yaw)*Math.cos(st.pitch)*R,-Math.sin(st.pitch)*R,Math.cos(st.yaw)*Math.cos(st.pitch)*R], T=trace(); let VP=null;
      GL.render(cv,(w,h)=>{ VP=M4.mul(M4.persp(.62,w/h,.1,100),M4.lookAt(eye,[0,0,0],[0,1,0]));
        GL.bind(0,gl.TEXTURE_CUBE_MAP,TX.sky.t,SM.mip);
        GL.use(P.box,{uVP:VP,uB:B,uCube:0,uCam:eye,uOnly:[0,0,0],uAlpha:1}); GL.draw(MESH.cube);
        GL.use(P.flat,{uMVP:M4.mul(VP,M4.S(B)),uColor:[.42,.42,.47,1]}); GL.draw(MESH.edges);
        GL.use(P.env,{uModel:M4.id(),uVP:VP,uCube:0,uCam:eye,uMode:0,uIOR:1}); GL.draw(MESH.sphere);
        // the sampled face, when it is one of the walls hidden to see in: drawn see-through so the sampled spot shows its texel
        const f=faceOf(T.look).f; if(k>=3&&V3.dot(f.n,V3.sub(eye,f.n.map(v=>v*B)))>0){ gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
          GL.use(P.box,{uVP:VP,uB:B,uCube:0,uCam:eye,uOnly:f.n,uAlpha:.6}); GL.draw(MESH.cube); gl.depthMask(true); gl.disable(gl.BLEND); } });
      if(VP) overlay(VP,eye,T); readout(T);
      cap.textContent=T.miss?"the ray misses the model":["view direction i","normal n","r = reflect(i, n)","texture(skybox, r)"][k]; } };
})();

/* ---------- refraction: Snell's law ---------- */
(() => {
  const svg=$("rrSvg"), read=$("rrRead"), Px=380, Py=300, L=260;
  const M=[["Vacuum",1],["Air",1.000293],["Water ice",1.31],["Water",1.33],["Ethanol",1.361],["Acrylic",1.49],["Window glass",1.52],["Amber",1.55],["Polycarbonate",1.6],["Sapphire",1.77],["Cubic zirconia",2.15],["Diamond",2.417]];
  const box=$("rrMats"); box.innerHTML=M.map((m,i)=>`<button class="btn sm" data-k="${i}">${m[0]} <span class="mono" style="opacity:.7">${m[1]}</span></button>`).join("");
  let mat=3, out=false, ang=.7;
  const setMat=tabs(box,k=>{ mat=+k; draw(); });
  const setOut=toggle($("rrSwap"),on=>{ out=on; draw(); });
  const g=svgEl("g",{},svg);
  svg.addEventListener("pointerdown",e=>{ svg.setPointerCapture(e.pointerId); svg._drag=true; move(e); });
  svg.addEventListener("pointermove",e=>{ if(svg._drag) move(e); }); svg.addEventListener("pointerup",()=>svg._drag=false);
  function move(e){ const [mx,my]=svgXY(e,svg); if(my>Py-10) return; ang=clamp(Math.atan2(Px-mx,Py-my),-1.45,1.45); draw(); }
  function draw(){
    g.innerHTML=""; const nM=M[mat][1], n1=out?nM:1.000293, n2=out?1.000293:nM;
    svgEl("rect",{x:0,y:out?0:Py,width:760,height:out?Py:620-Py,fill:"rgba(106,184,255,.13)"},g);
    svgEl("line",{x1:0,y1:Py,x2:760,y2:Py,stroke:MUTE,"stroke-width":2},g);
    svgEl("line",{x1:Px,y1:30,x2:Px,y2:590,stroke:MUTE,"stroke-width":1.5,"stroke-dasharray":"6 8"},g);
    textSvg(g,`n₁ = ${fmt(n1,4)}  ${out?M[mat][0].toLowerCase():"air"}`,24,40,INK,17); textSvg(g,`n₂ = ${fmt(n2,4)}  ${out?"air":M[mat][0].toLowerCase()}`,24,Py+36,INK,17);
    const th1=Math.abs(ang), sx=ang>=0?-1:1, S=[Px+sx*Math.sin(th1)*L,Py-Math.cos(th1)*L];
    arrowSvg(g,S[0],S[1],Px,Py,BLUE,5); svgEl("circle",{cx:S[0],cy:S[1],r:12,fill:BLUE,opacity:.35},g);
    const s2=n1/n2*Math.sin(th1); let html;
    const arc=(a,b,R,c)=>svgEl("path",{d:`M${Px+R*Math.cos(a)},${Py+R*Math.sin(a)} A${R},${R} 0 0 ${b>a?1:0} ${Px+R*Math.cos(b)},${Py+R*Math.sin(b)}`,fill:"none",stroke:c,"stroke-width":2.5},g);
    arc(-Math.PI/2,-Math.PI/2+sx*th1,80,BLUE);
    if(s2<=1){ const th2=Math.asin(s2); arrowSvg(g,Px,Py,Px-sx*Math.sin(th2)*L,Py+Math.cos(th2)*L,Y,6); arc(Math.PI/2,Math.PI/2+sx*th2,80,Y);
      svgEl("line",{x1:Px,y1:Py,x2:Px-sx*Math.sin(th1)*L,y2:Py+Math.cos(th1)*L,stroke:BLUE,"stroke-width":2,"stroke-dasharray":"4 8",opacity:.45},g);
      textSvg(g,"no bending",Px-sx*Math.sin(th1)*L*.95,Py+Math.cos(th1)*L*.95+22,BLUE,13,"middle");
      html=`θ₁ = <b style="color:var(--blue)">${(th1*180/Math.PI).toFixed(1)}°</b> &nbsp; θ₂ = <b>${(th2*180/Math.PI).toFixed(1)}°</b><br>${fmt(n1,3)} × sin θ₁ = ${fmt(n2,3)} × sin θ₂ = ${(n1*Math.sin(th1)).toFixed(3)}`; }
    else { arrowSvg(g,Px,Py,Px-sx*Math.sin(th1)*L,Py-Math.cos(th1)*L,RED,6);
      html=`θ₁ = <b style="color:var(--blue)">${(th1*180/Math.PI).toFixed(1)}°</b> is past the critical angle (${(Math.asin(n2/n1)*180/Math.PI).toFixed(1)}°)<br><b style="color:var(--red)">total internal reflection</b>: refract() returns 0`; }
    read.innerHTML=html;
  }
  A.refract={ enter(){ mat=3; setMat("3"); out=false; setOut(false); ang=.7; draw(); } };
})();

/* ---------- environment mapping demo ---------- */
(() => {
  const cv=$("evCv"), cap=$("evCap"); let mode="refl", shape="sphere";
  const st=orbit(cv,{yaw:0,pitch:-.1},{k:.006});
  const setM=tabs($("evMode"),k=>{ mode=k; $("evIorRow").style.visibility=k==="refr"?"visible":"hidden"; });
  const setS=tabs($("evShape"),k=>shape=k);
  const io=slider("evIor",v=>v.toFixed(2));
  A.envdemo={
    enter(){ mode="refl"; setM("refl"); $("evIorRow").style.visibility="hidden"; shape="sphere"; setS("sphere"); io.set(1.33); st.yaw=0; st.pitch=-.1; },
    tick(dt,now){
      if(!GL||!P.env) return noGL(cv); if(!TX.sky.ready) return;
      const gl=GL.gl;
      GL.render(cv,(w,h)=>{
        const R=3.4, eye=[Math.sin(st.yaw)*Math.cos(st.pitch)*R,-Math.sin(st.pitch)*R,Math.cos(st.yaw)*Math.cos(st.pitch)*R];
        const proj=M4.persp(1,w/h,.05,100), V=M4.lookAt(eye,[0,0,0],[0,1,0]);
        GL.bind(0,gl.TEXTURE_CUBE_MAP,TX.sky.t,SM.mip);
        gl.depthMask(false); GL.use(P.sky,{uVP:M4.mul(proj,M4.rotOnly(V)),uCube:0}); GL.draw(MESH.cube); gl.depthMask(true);
        const model=M4.chain(M4.RY(now*.0003),M4.RX(shape==="torus"?.5:0),M4.S(shape==="cube"?.8:1));
        GL.use(P.env,{uModel:model,uVP:M4.mul(proj,V),uCube:0,uCam:eye,uMode:mode==="refr"?1:0,uIOR:io.get()}); GL.draw(MESH[shape]);
      });
      cap.textContent=mode==="refl"?"reflect(viewDir, normal)":`refract(viewDir, normal, 1.0 / ${io.get().toFixed(2)})`;
    }
  };
})();

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
