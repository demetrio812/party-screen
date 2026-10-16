/* Short, clock-based overlays: both windows render the same event independently. */
class PartyCelebrations {
 constructor(stage,gentle){
  this.canvas=document.createElement('canvas');this.canvas.className='celebration-layer';this.canvas.setAttribute('aria-hidden','true');stage.append(this.canvas);
  this.ctx=this.canvas.getContext('2d');this.gentle=gentle;this.event=null;this.particles=[];
  new ResizeObserver(()=>{const r=stage.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);this.ctx.setTransform(d,0,0,d,0,0)}).observe(stage);
  const frame=()=>{this.draw();requestAnimationFrame(frame)};requestAnimationFrame(frame);
 }
 set(event){
  if(!event||(!Object.hasOwn(PartyMoments.celebrations,event.kind)||event.kind==='none')||!Number.isFinite(event.startedAt)||!Number.isFinite(event.duration)||event.duration<3||event.duration>15||!Number.isFinite(event.amount)||!Number.isFinite(event.speed)||!Number.isFinite(event.seed)||!PartyMoments.palettes[event.palette]){this.event=null;return}
  this.event={...event};let seed=event.seed>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  this.particles=Array.from({length:Math.round(60+Math.min(100,Math.max(10,event.amount))*2.3)},(_,i)=>({side:i%2,x:random(),y:random(),vx:.12+random()*.3,vy:.82+random()*.75,spin:(random()-.5)*8,phase:random()*Math.PI*2,size:3+random()*7,delay:random()*.55,colour:Math.floor(random()*4)}));
 }
 draw(){
  const c=this.ctx,w=this.w||1,h=this.h||1;c.clearRect(0,0,w,h);const e=this.event;if(!e)return;
  const elapsed=(Date.now()-e.startedAt)/1000;if(elapsed<0||elapsed>e.duration){if(elapsed>e.duration)this.event=null;return}
  const p=PartyMoments.palettes[e.palette],colours=[p.accent,p.light,'#ffd984',p.accent],gentle=this.gentle(),speed=Math.min(150,Math.max(50,e.speed))/100;
  const fade=Math.min(1,elapsed*7,(e.duration-elapsed)/1.2);c.save();
  if(e.kind==='tunnel'){
   c.globalCompositeOperation='screen';const max=Math.hypot(w,h)*.75,travel=elapsed*speed*(gentle?.055:.16);
   for(let i=0;i<17;i++){const position=(i/17+travel)%1,r=(.02+position*position)*max;c.beginPath();c.ellipse(w*.5,h*.48,r,r*.64,0,0,Math.PI*2);c.strokeStyle=i%3?p.accent:p.light;c.globalAlpha=fade*Math.sin(position*Math.PI)*.36*(e.amount/100);c.lineWidth=1+position*5;c.shadowColor=p.accent;c.shadowBlur=gentle?0:12;c.stroke()}
   c.shadowBlur=0;c.globalAlpha=fade*.1;
   for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(w*.5+Math.cos(a)*20,h*.48+Math.sin(a)*14);c.lineTo(w*.5+Math.cos(a)*max,h*.48+Math.sin(a)*max*.64);c.strokeStyle=p.accent;c.lineWidth=1;c.stroke()}
  }else if(e.kind==='lasers'){
   c.globalCompositeOperation='screen';const motion=elapsed*speed*(gentle?.12:.45),amount=Math.round(4+e.amount/12);
   for(let side=0;side<2;side++)for(let i=0;i<amount;i++){
    const x=w*(side?.98:.02),y=h*1.04,angle=-Math.PI*.5+(side?-1:1)*(.1+i*.065)+Math.sin(motion+i*.24)*.26;
    const length=Math.hypot(w,h)*1.5,ex=x+Math.cos(angle)*length,ey=y+Math.sin(angle)*length;
    const gradient=c.createLinearGradient(x,y,ex,ey);gradient.addColorStop(0,p.light);gradient.addColorStop(.25,p.accent);gradient.addColorStop(1,'transparent');
    c.globalAlpha=fade*(gentle?.16:.28);c.strokeStyle=gradient;c.lineWidth=1.5+i%3;c.shadowColor=p.accent;c.shadowBlur=12;c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.stroke();
   }
  }else if(e.kind==='ribbons'){
   const motion=elapsed/e.duration*5*speed*(gentle?.5:1),count=Math.round(5+e.amount/9);
   for(let i=0;i<count;i++){
    const q=this.particles[i],x=w*(i+.5)/count,y=((q.y+motion*.24)%1.5-.25)*h;
    c.beginPath();for(let step=0;step<35;step++){const yy=y+step*5,xx=x+Math.sin(step*.24+motion*2+q.phase)*(12+w*.015);if(!step)c.moveTo(xx,yy);else c.lineTo(xx,yy)}
    c.strokeStyle=colours[i%4];c.globalAlpha=fade*.72;c.lineWidth=4+q.size*.65;c.lineCap='round';c.stroke();
   }
  }else{
   const count=gentle?Math.ceil(this.particles.length*.5):this.particles.length;
   for(let i=0;i<count;i++){
    const q=this.particles[i],age=elapsed/e.duration*6*speed-q.delay;if(age<0)continue;
    let x,y,rotation;
    if(e.kind==='confetti'){
     // Opposing cannons arc into the room, with gravity and a fluttering descent.
     const flight=age*(gentle?.65:1);
     x=w*((q.side?.97:.03)+(q.side?-1:1)*q.vx*flight)+Math.sin(age*3+q.phase)*12;
     y=h*(1.03-q.vy*flight+.25*flight*flight);rotation=q.phase+age*q.spin;
    }else if(e.kind==='sparks'){
     const flight=(age*(gentle?.55:1)+q.y*1.8)%1.8;
     x=w*(.12+Math.floor(q.x*4)*.25)+(q.vx-.3)*flight*w*.13;
     y=h*(1.02-q.vy*flight*.55+.26*flight*flight);rotation=0;
    }else if(e.kind==='hearts'){
     x=w*q.x+Math.sin(age*.7+q.phase)*w*.045;
     y=h*(1.15-q.y*.25-age*(gentle?.13:.23));rotation=Math.sin(age*.7+q.phase)*.25;
    }else{
     x=w*q.x+Math.sin(age*(gentle?.3:.8)+q.phase)*w*.045;
     y=h*((q.y*.65-.65)+age*(gentle?.12:.23));rotation=q.phase+age*q.spin*.12;
    }
    if(y>h+40||y< -60||x< -50||x>w+50)continue;
    c.save();c.translate(x,y);c.rotate(rotation);c.globalAlpha=fade*(.65+.35*Math.sin(q.phase+age)**2);c.fillStyle=colours[q.colour];
    const size=q.size*(w<650?.8:1.2);
    if(e.kind==='hearts'){
     const a=size*1.7;c.beginPath();c.moveTo(0,a*.55);c.bezierCurveTo(-a*1.7,-a*.45,-a*.6,-a*1.5,0,-a*.7);c.bezierCurveTo(a*.6,-a*1.5,a*1.7,-a*.45,0,a*.55);c.closePath();c.fill();
    }else if(e.kind==='sparks'){
     c.strokeStyle=i%3?'#ffd984':'#fff8df';c.shadowColor='#ffb83e';c.shadowBlur=gentle?0:9;c.lineWidth=1+size*.15;c.beginPath();c.moveTo(0,0);c.lineTo(-q.vx*3,5+size);c.stroke();
    }else if(e.kind==='stars'){
     c.shadowColor=p.accent;c.shadowBlur=10;c.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,r=size*(k%2?.45:1.25);if(k===0)c.moveTo(Math.cos(a)*r,Math.sin(a)*r);else c.lineTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fill();
    }else{c.scale(Math.cos(age*5+q.phase)*.8+.2,1);c.fillRect(-size/2,-size/2,size,size*(i%3?1.6:.6))}
    c.restore();
   }
  }
  c.restore();
 }
}
