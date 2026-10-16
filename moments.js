/* Shared moment data and playback timing. Runs in the browser and Node. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PartyMoments=api})(globalThis,function(){
'use strict';
const palettes={
 pink:{name:'Pink',accent:'#ff3296',light:'#fff3fa',background:'#100510',rgb:[255,50,150],secondary:[255,157,205]},
 chrome:{name:'Chrome',accent:'#b8d5ff',light:'#ffffff',background:'#050b17',rgb:[136,184,255],secondary:[225,236,255]},
 dream:{name:'Dream',accent:'#b398ff',light:'#fff3fa',background:'#10091d',rgb:[179,152,255],secondary:[255,175,223]},
 cherry:{name:'Cherry',accent:'#ff626d',light:'#fff3dd',background:'#190608',rgb:[255,75,95],secondary:[255,187,130]}
};
const effects={beams:'Concert beams',halo:'Bass halo',bars:'Light columns',confetti:'Confetti shower'};
const celebrations={none:'None',confetti:'Confetti cannons',stars:'Star shower',tunnel:'Light tunnel',lasers:'Laser fans',sparks:'Spark fountains',hearts:'Floating hearts',ribbons:'Ribbon streamers'};
const typefaces={solid:'Big & bold',outline:'Neon outline',wide:'Wide headline'};
const base={intro:'Your night. Your stage.',tagline:'',palette:'pink',effect:'beams',typeface:'solid',intensity:65,duration:0,kind:'scene',celebration:'none',burstDuration:7,amount:65,speed:100};
function defaults(){return [
 {...base,id:'welcome',name:'Welcome',message:'LEVEL\nELEVEN',tagline:'Your birthday world tour',intensity:45},
 {...base,id:'dance',name:'Dance floor',message:'OWN THE\nDANCE FLOOR',intro:'This is your headline moment.',tagline:'Turn it up',palette:'chrome',effect:'bars',typeface:'outline',intensity:85},
 {...base,id:'hands',name:'Hands in the air',celebration:'stars',message:'HANDS IN\nTHE AIR',intro:'Everybody together',palette:'dream',effect:'halo',typeface:'wide',intensity:75,duration:8},
 {...base,id:'noise',name:'Make some noise',message:'MAKE SOME\nNOISE',intro:'Let’s hear you!',palette:'cherry',effect:'beams',intensity:95,duration:8},
 {...base,id:'birthday',name:'Birthday',celebration:'confetti',message:'HAPPY\nBIRTHDAY',intro:'The birthday girl takes the stage.',tagline:'Make a wish',palette:'dream',effect:'confetti',intensity:75},
 {...base,id:'countdown',name:'Countdown',celebration:'tunnel',message:'LET’S GO!',intro:'',palette:'cherry',effect:'halo',typeface:'outline',intensity:95,kind:'countdown',duration:5}
]}
function validateMoment(value){
 if(!value||typeof value!=='object')throw Error('Each moment needs its own settings.');
 for(const [field,max] of [['id',100],['name',48],['message',65],['intro',90],['tagline',80]]){
  if(typeof value[field]!=='string'||value[field].length>max)throw Error('Check the '+field+' text.');
 }
 if(!value.id.trim()||!value.name.trim()||!value.message.trim())throw Error('Give the moment a name and some main words.');
 if(!Object.hasOwn(palettes,value.palette))throw Error('Choose a valid colour palette.');
 if(!Object.hasOwn(effects,value.effect))throw Error('Choose a valid light effect.');
 if(!Object.hasOwn(typefaces,value.typeface))throw Error('Choose a valid lettering style.');
 if(!['scene','countdown'].includes(value.kind))throw Error('Choose a valid moment type.');
 if(!Number.isFinite(value.intensity)||value.intensity<0||value.intensity>100)throw Error('Effect strength must be from 0 to 100.');
 if(!Number.isFinite(value.duration)||value.duration<0||value.duration>300)throw Error('Duration must be from 0 to 300 seconds.');
 const celebration=value.celebration??({birthday:'confetti',hands:'stars',countdown:'tunnel'}[value.id]||'none');
 if(!Object.hasOwn(celebrations,celebration))throw Error('Choose a valid celebration effect.');
 const burstDuration=value.burstDuration??7,amount=value.amount??65,speed=value.speed??100;
 for(const [label,v,min,max] of [['Celebration duration',burstDuration,3,15],['Amount',amount,10,100],['Speed',speed,50,150]])if(!Number.isFinite(v)||v<min||v>max)throw Error(label+' is out of range.');
 return {celebration,burstDuration,amount,speed,id:value.id,name:value.name.trim(),message:value.message.trim(),intro:value.intro,tagline:value.tagline,palette:value.palette,effect:value.effect,typeface:value.typeface,intensity:value.intensity,duration:value.duration,kind:value.kind};
}
function parseBackup(text){
 let data;try{data=JSON.parse(text)}catch{throw Error('Choose a valid JSON moments backup.')}
 if(data?.version!==2||!Array.isArray(data.moments))throw Error('Choose a Party screen moments backup.');
 if(data.moments.length<1||data.moments.length>100)throw Error('A backup needs at least one moment, up to 100.');
 const moments=data.moments.map(validateMoment),ids=new Set();
 for(const m of moments){if(ids.has(m.id))throw Error('This backup has duplicate moment IDs.');ids.add(m.id)}
 return moments;
}
function resolvePlayback(playback,now){
 if(playback?.endAt&&now>=playback.endAt)return {scene:{...playback.returnScene},startedAt:now,endAt:0,returnScene:null};
 return playback;
}
function startPlayback(moment,prior,now){
 prior=resolvePlayback(prior,now);
 const temporary=moment.kind==='countdown'||moment.duration>0;
 const returnScene=temporary?{...(prior?.returnScene||prior?.scene||defaults()[0])}:null;
 return {scene:{...moment},startedAt:now,endAt:temporary?now+(moment.kind==='countdown'?5000:moment.duration*1000):0,returnScene};
}
function displayWords(playback,now){
 const scene=playback.scene;
 if(scene.kind==='countdown'&&playback.endAt){const step=Math.floor(Math.max(0,now-playback.startedAt)/1000);return {message:step<3?String(3-step):'LET’S GO!',intro:'',tagline:'',count:step<3}}
 return {message:scene.message,intro:scene.intro,tagline:scene.tagline,count:false};
}
return {palettes,effects,celebrations,typefaces,defaults,validateMoment,parseBackup,startPlayback,resolvePlayback,displayWords};
});
