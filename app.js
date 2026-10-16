'use strict';
const $=id=>document.getElementById(id),M=PartyMoments;
const stage=$('stage'),canvas=$('lights'),ctx=canvas.getContext('2d');
const isScreen=new URLSearchParams(location.search).get('view')==='screen';
const LIBRARY='level-eleven-moments-v2',RUNTIME='level-eleven-playing-v2',PREFS='level-eleven-sound-v2';
let storageWarning=false;
function readJSON(key,fallback){try{const text=localStorage.getItem(key);return text?JSON.parse(text):fallback}catch{return fallback}}
function store(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true}catch{storageWarning=true;if(!isScreen)$('editor-notice').textContent='Browser saving is unavailable. Download a backup before closing.';return false}}
let moments;
try{const existing=localStorage.getItem(LIBRARY);moments=existing?M.parseBackup(existing):M.defaults();if(!existing){const old=readJSON('level-eleven-screen-v1',null);if(old){moments[0]=M.validateMoment({...moments[0],message:String(old.message||moments[0].message).slice(0,65),tagline:String(old.tagline||moments[0].tagline).slice(0,80),...(M.palettes[old.palette]?{palette:old.palette}:{}),...(M.effects[old.effect]?{effect:old.effect}:{}),...(Number.isFinite(old.intensity)?{intensity:Math.min(100,Math.max(0,old.intensity))}:{})})}}}catch{moments=M.defaults();storageWarning=true}
const initialPrefs=readJSON(PREFS,{});
const settings={sensitivity:Number.isFinite(initialPrefs.sensitivity)?Math.min(100,Math.max(0,initialPrefs.sensitivity)):50,gentle:matchMedia('(prefers-reduced-motion: reduce)').matches||!!initialPrefs.gentle};
function validPlayback(data){try{if(!data||!Number.isFinite(data.startedAt)||!Number.isFinite(data.endAt))return null;const scene=M.validateMoment(data.scene),returnScene=data.returnScene?M.validateMoment(data.returnScene):null;if(data.endAt&&!returnScene)return null;return M.resolvePlayback({...data,scene,returnScene},Date.now())}catch{return null}}
let playback=validPlayback(readJSON(RUNTIME,null))||M.startPlayback(moments[0],null,Date.now());
const palettes=M.palettes;
let mode='idle',stream=null,audioContext=null,analyser=null,freq=null,waveform=null;
let attempt=0,width=1,height=1,dpr=1,lastTime=0,pulse=0,level=0,bass=0,bassAverage=.05,lastBeat=-10;
let previousBass=0,idleTimer=null,bands=Array(40).fill(0),lastRemoteFrame=0;
let sceneKey='',wordsKey='',lastCountdown=-1,projectionWindow=null;
let channel=null;try{channel=new BroadcastChannel('level-eleven-party-v2')}catch{}
function send(message){channel?.postMessage(message)}
const FX_KEY='level-eleven-celebration-v1';
let celebrationEvent=readJSON(FX_KEY,null);
const celebrationLayer=new PartyCelebrations(stage,()=>settings.gentle);
function receiveCelebration(event){celebrationEvent=event;celebrationLayer.set(event);$('fx-status').textContent=event&&Date.now()<event.startedAt+event.duration*1000?M.celebrations[event.kind]+' fired':'Ready for your next effect.'}
function fireCelebration(kind,scene=playback.scene){
 const valid=M.validateMoment(scene);
 const event=kind==='none'?null:{kind,startedAt:Date.now(),duration:valid.burstDuration,amount:valid.amount,speed:valid.speed,palette:valid.palette,seed:Math.floor(Math.random()*100000)};
 receiveCelebration(event);store(FX_KEY,event);send({type:'celebration',event});
}
document.querySelectorAll('[data-fire]').forEach(b=>b.addEventListener('click',()=>fireCelebration(b.dataset.fire)));
$('clear-effects').addEventListener('click',()=>fireCelebration('none'));
receiveCelebration(celebrationEvent);
function savePlayback(){store(RUNTIME,playback);send({type:'playback',playback})}
function saveLibrary(){store(LIBRARY,{version:2,moments});send({type:'library',moments});send({type:'celebration',event:celebrationEvent})}
function persist(){store(PREFS,settings);send({type:'preferences',settings});document.body.classList.toggle('gentle',settings.gentle)}
function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error)}
function stageStatus(text){$('stage-status').replaceChildren(Object.assign(document.createElement('i'),{className:'live-dot'}),document.createTextNode(text));stage.dataset.mode=mode}
function setWords(text,count=false){const title=$('title');title.textContent=text;title.classList.toggle('long',text.replace(/\s/g,'').length>14);title.classList.toggle('count',count)}
function applyScene(){
 lastCountdown=-1;
 const scene=playback.scene,p=palettes[scene.palette];
 stage.style.setProperty('--accent',p.accent);stage.style.setProperty('--light',p.light);
 document.body.classList.remove('type-solid','type-outline','type-wide');document.body.classList.add('type-'+scene.typeface);
 stage.classList.remove('scene-change');void stage.offsetWidth;stage.classList.add('scene-change');
 $('current-name').textContent=scene.name;renderMoments();
}
function launch(scene){scene=M.validateMoment(scene);fireCelebration(scene.celebration,scene);playback=M.startPlayback(scene,playback,Date.now());sceneKey='';pulse=1;savePlayback();updatePlayback(Date.now())}
function returnNow(){if(!playback.returnScene)return;fireCelebration('none');playback={scene:{...playback.returnScene},startedAt:Date.now(),endAt:0,returnScene:null};sceneKey='';savePlayback();updatePlayback(Date.now())}
function updatePlayback(now){
 const resolved=M.resolvePlayback(playback,now);
 if(resolved!==playback){if(!isScreen)fireCelebration('none');playback=resolved;sceneKey='';if(!isScreen)savePlayback()}
 const key=playback.startedAt+':'+playback.scene.id;
 if(key!==sceneKey){sceneKey=key;wordsKey='';applyScene()}
 const words=M.displayWords(playback,now),newWords=JSON.stringify(words);
 if(newWords!==wordsKey){wordsKey=newWords;setWords(words.message,words.count);$('intro').textContent=words.intro;$('subtitle').textContent=words.tagline;if(playback.scene.kind==='countdown')pulse=1}
 const remaining=playback.endAt?Math.max(0,Math.ceil((playback.endAt-now)/1000)):0;
 if(remaining!==lastCountdown){lastCountdown=remaining;$('return-note').textContent=remaining?'Returns to '+playback.returnScene.name+' in '+remaining+'s':'Stays until you choose another moment';$('return-moment').hidden=!remaining}
}
function sceneVariables(el,m){const p=palettes[m.palette];el.style.setProperty('--scene-bg',p.background);el.style.setProperty('--scene-accent',p.accent);el.style.setProperty('--scene-light',p.light)}
function renderMoments(){
 const grid=$('moments-grid');grid.replaceChildren();
 for(const m of moments){const button=document.createElement('button');button.className='moment-button type-'+m.typeface;button.dataset.id=m.id;button.dataset.effect=m.effect;button.setAttribute('aria-label','Launch '+m.name);const active=playback.scene.id===m.id;button.setAttribute('aria-pressed',String(active));sceneVariables(button,m);
 const art=document.createElement('span');art.className='moment-art';const title=document.createElement('b');title.textContent=m.kind==='countdown'?'3, 2, 1…':m.message;art.append(title);
 const meta=document.createElement('span');meta.className='moment-meta';const name=document.createElement('strong');name.textContent=m.name;const note=document.createElement('small');note.textContent=M.palettes[m.palette].name+' / '+(m.kind==='countdown'?'5s countdown':m.duration?m.duration+'s then return':'Stay on screen');meta.append(name,note);button.append(art,meta);
 if(active){const tag=document.createElement('span');tag.className='playing-tag';tag.textContent='On screen';button.append(tag)}
 button.addEventListener('click',()=>launch(m));grid.append(button);
 }
}
// The editor has its own draft. Editing or saving never mutates the live snapshot.
let selectedId=moments[0].id,draft=null,dirty=false,pendingImport=null,deleteConfirm=false;
const fields=['name','message','intro','tagline','palette','typeface','effect','intensity','kind','duration','celebration','burstDuration','amount','speed'];
function notice(text,error=false){$('editor-notice').textContent=text;$('editor-notice').classList.toggle('error',error)}
function editorSelection(){const select=$('moment-select');select.replaceChildren();for(const m of moments)select.add(new Option(m.name,m.id));if(!moments.some(m=>m.id===selectedId))select.add(new Option('New moment (unsaved)',selectedId));select.value=selectedId;const i=moments.findIndex(m=>m.id===selectedId);$('move-up').disabled=i<=0;$('move-down').disabled=i<0||i===moments.length-1;$('delete-moment').disabled=i<0||moments.length===1}
function fillEditor(m){draft={...M.validateMoment(m)};selectedId=m.id;dirty=false;deleteConfirm=false;$('delete-moment').textContent='Delete';editorSelection();for(const field of fields)$('edit-'+field).value=draft[field];previewDraft()}
function readDraft(){for(const field of fields)draft[field]=['intensity','duration','burstDuration','amount','speed'].includes(field)?Number($('edit-'+field).value):$('edit-'+field).value;return draft}
function previewDraft(){const m=readDraft(),preview=$('editor-preview');sceneVariables(preview,m);preview.className='editor-preview type-'+m.typeface;preview.dataset.effect=m.effect;$('preview-intro').textContent=m.intro;$('preview-words').textContent=m.kind==='countdown'?'3, 2, 1…':m.message;$('preview-tagline').textContent=m.tagline;$('edit-intensity-value').textContent=m.intensity+'%';$('edit-duration').disabled=m.kind==='countdown';$('duration-help').textContent=m.kind==='countdown'?'Counts 3, 2, 1, then LET’S GO! Returns to the previous scene after 5 seconds.':'0 keeps this moment on screen until you choose another.'}
function discardDraft(){return !dirty||confirm('Discard the unsaved changes to this moment?')}
function selectEditor(id){if(!discardDraft()){$('moment-select').value=selectedId;return}fillEditor(moments.find(m=>m.id===id)||moments[0]);notice('')}
function saveDraft(run=false){
 if(!$('moment-form').reportValidity())return;
 let m;try{m=M.validateMoment(readDraft())}catch(error){notice(error.message,true);return}
 const index=moments.findIndex(item=>item.id===m.id);if(index<0){if(moments.length>=100){notice('The library holds up to 100 moments.',true);return}moments.push(m)}else moments[index]=m;
 saveLibrary();fillEditor(m);renderMoments();notice(storageWarning?'Saved for this session. Download a backup before closing.':'Saved. '+(run?'Launching now.':'Ready to launch from Run party.'));
 if(run)launch(m);
}
function tab(name){const edit=name==='edit';$('run-view').hidden=edit;$('edit-view').hidden=!edit;for(const key of ['run','edit']){$(key+'-tab').setAttribute('aria-selected',String((key==='edit')===edit));$(key+'-tab').tabIndex=((key==='edit')===edit)?0:-1}}
$('run-tab').addEventListener('click',()=>tab('run'));$('edit-tab').addEventListener('click',()=>tab('edit'));
for(const name of ['run','edit'])$(name+'-tab').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'run':e.key==='End'?'edit':name==='run'?'edit':'run';tab(next);$(next+'-tab').focus()}});
for(const field of fields)$('edit-'+field).addEventListener('input',()=>{dirty=true;deleteConfirm=false;$('delete-moment').textContent='Delete';previewDraft();notice('Unsaved changes')});
$('moment-select').addEventListener('change',e=>selectEditor(e.target.value));
$('moment-form').addEventListener('submit',e=>{e.preventDefault();saveDraft()});$('save-launch').addEventListener('click',()=>saveDraft(true));
function newId(){return 'moment-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))}
$('add-moment').addEventListener('click',()=>{if(!discardDraft())return;fillEditor({...M.defaults()[0],id:newId(),name:'New moment',message:'YOUR\nMOMENT',intro:'',tagline:''});dirty=true;notice('Choose a look, then save your new moment.');$('edit-name').focus()});
$('duplicate-moment').addEventListener('click',()=>{const copy={...readDraft(),id:newId(),name:(draft.name+' copy').slice(0,48)};fillEditor(copy);dirty=true;notice('A new copy is ready to edit. Save it to add it to the library.')});
for(const [id,delta] of [['move-up',-1],['move-down',1]])$(id).addEventListener('click',()=>{const index=moments.findIndex(m=>m.id===selectedId),target=index+delta;if(index<0||target<0||target>=moments.length)return;[moments[index],moments[target]]=[moments[target],moments[index]];saveLibrary();renderMoments();editorSelection();notice('Moment order saved.')});
$('delete-moment').addEventListener('click',()=>{if(moments.length===1)return;if(!deleteConfirm){deleteConfirm=true;$('delete-moment').textContent='Confirm delete';notice('Click Confirm delete to remove this saved moment.');return}const index=moments.findIndex(m=>m.id===selectedId);if(index<0)return;moments.splice(index,1);saveLibrary();fillEditor(moments[Math.min(index,moments.length-1)]);renderMoments();notice('Moment deleted. The scene on screen keeps playing.')});
$('export-moments').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:2,moments},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='level-eleven-moments.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Backup downloaded. It contains your saved moments.')});
$('import-moments').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];pendingImport=null;$('restore-review').hidden=true;if(!file)return;try{if(file.size>300000)throw Error('That file is too large for a moments backup.');pendingImport=M.parseBackup(await file.text());$('restore-description').textContent='Replace your saved library with '+pendingImport.length+' moments from this backup? The scene on screen keeps playing.';$('restore-review').hidden=false;notice('Backup checked. Review before replacing your library.')}catch(error){notice(error.message,true)}finally{e.target.value=''}});
$('cancel-restore').addEventListener('click',()=>{pendingImport=null;$('restore-review').hidden=true;notice('Restore cancelled.')});
$('confirm-restore').addEventListener('click',()=>{if(!pendingImport||!discardDraft())return;moments=pendingImport;pendingImport=null;saveLibrary();fillEditor(moments[0]);renderMoments();$('restore-review').hidden=true;notice('Moment library restored. Choose a moment in Run party to launch it.')});
$('return-moment').addEventListener('click',returnNow);
function initControls(){
 for(const [id,choices] of [['palette',Object.fromEntries(Object.entries(palettes).map(([k,p])=>[k,p.name]))],['effect',M.effects],['celebration',M.celebrations],['typeface',M.typefaces]])for(const [value,label] of Object.entries(choices))$('edit-'+id).add(new Option(label,value));
 $('sensitivity').value=settings.sensitivity;$('sensitivity-value').textContent=settings.sensitivity+'%';$('gentle').checked=settings.gentle;document.body.classList.toggle('gentle',settings.gentle);
 fillEditor(moments[0]);renderMoments();updatePlayback(Date.now());
 if(storageWarning)notice('Saved moments could not be loaded. The starter moments are available; download a backup of your edits.',true);
}

function releaseAudio(){
 if(stream){for(const track of stream.getTracks()){track.onended=null;track.stop()}stream=null}
 if(audioContext){audioContext.close().catch(()=>{});audioContext=null}
 analyser=null;freq=null;waveform=null;
}
function resetSound(){level=0;bass=0;previousBass=0;bassAverage=.05;bands.fill(0)}
function stop(){attempt++;releaseAudio();mode='idle';resetSound();$('listen').disabled=false;$('listen').textContent='Listen to speakers';$('listen').setAttribute('aria-pressed','false');$('demo').setAttribute('aria-pressed','false');stageStatus('Ready when you are');setStatus('Microphone off. Start the music, then switch listening on.')}
async function listDevices(){
 try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');const choice=$('device').value;
 $('device').replaceChildren(new Option('Default microphone',''));
 devices.forEach((d,i)=>$('device').add(new Option(d.label||'Microphone '+(i+1),d.deviceId)));
 if(devices.some(d=>d.deviceId===choice))$('device').value=choice;
 }catch{}
}
async function listen(){
 stop();const thisAttempt=++attempt;
 if(!navigator.mediaDevices?.getUserMedia){setStatus('Microphone listening needs a local browser page. Use Start Party Screen.command, then open it in Chrome or Safari.',true);return}
 mode='pending';$('listen').textContent='Cancel listening';setStatus('Allow the microphone when your browser asks.');
 try{
  const device=$('device').value;
  const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1,...(device?{deviceId:{exact:device}}:{})},video:false});
  if(thisAttempt!==attempt){acquired.getTracks().forEach(t=>t.stop());return}
  stream=acquired;
  audioContext=new (window.AudioContext||window.webkitAudioContext)();
  await audioContext.resume();
  if(thisAttempt!==attempt)return;
  analyser=audioContext.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.35;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  // Deliberately leave the analyser disconnected from audio output: no mic feedback.
  freq=new Uint8Array(analyser.frequencyBinCount);waveform=new Float32Array(analyser.fftSize);
  stream.getAudioTracks().forEach(t=>t.onended=()=>{stop();setStatus('The microphone disconnected. Choose an input and switch listening on again.',true)});
  mode='mic';$('listen').textContent='Stop listening';$('listen').setAttribute('aria-pressed','true');stageStatus('Following the speakers');setStatus('Listening locally. Move sensitivity up if the meter barely moves.');
  await listDevices();
 }catch(error){
  if(thisAttempt!==attempt)return;
  releaseAudio();mode='idle';$('listen').textContent='Listen to speakers';stageStatus('Microphone off');
  const messages={NotAllowedError:'Microphone access is blocked. Allow it in your browser’s site permissions, then try again.',NotFoundError:'No microphone was found. Connect one and try again.',NotReadableError:'The microphone is busy or unavailable. Check your audio input and try again.',OverconstrainedError:'That microphone is no longer available. Choose Default microphone and try again.'};
  setStatus(messages[error.name]||'The microphone could not start. Check your browser and audio input, then try again.',true);
 }finally{if(thisAttempt===attempt)$('listen').disabled=false}
}
$('listen').addEventListener('click',()=>['mic','pending'].includes(mode)?stop():listen());
$('device').addEventListener('change',()=>{if(mode==='mic')listen()});
$('demo').addEventListener('click',()=>{const enable=mode!=='demo';stop();if(enable){mode='demo';stageStatus('Preview rhythm · no microphone');setStatus('Visual preview only. Switch on listening to follow real music.');$('demo').setAttribute('aria-pressed','true')}});
$('sensitivity').addEventListener('input',e=>{settings.sensitivity=Number(e.target.value);$('sensitivity-value').textContent=settings.sensitivity+'%';persist()});
$('gentle').addEventListener('change',e=>{settings.gentle=e.target.checked;persist()});
async function project(){if(!isScreen)document.body.classList.add('projecting');if(!document.fullscreenElement){try{await document.documentElement.requestFullscreen()}catch{}}wake()}
function leave(){if(isScreen){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});wake();return}document.body.classList.remove('projecting','idle');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});clearTimeout(idleTimer)}
function wake(){document.body.classList.remove('idle');clearTimeout(idleTimer);if(isScreen||document.body.classList.contains('projecting'))idleTimer=setTimeout(()=>document.body.classList.add('idle'),2500)}
$('project').addEventListener('click',project);$('leave-projector').addEventListener('click',()=>isScreen?project():leave());document.addEventListener('pointermove',wake);
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){if(!isScreen)leave();else wake()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')leave();if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f'){e.preventDefault();document.fullscreenElement?leave():project()}});
$('open-screen').addEventListener('click',()=>{
 if(!channel){$('projection-note').textContent='This browser cannot link windows. Use Fill this screen instead, or try Chrome.';return}
 if(projectionWindow&&!projectionWindow.closed){projectionWindow.focus();return}
 savePlayback();persist();const url=new URL(location.href);url.search='?view=screen';projectionWindow=window.open(url.href,'level-eleven-projection','popup,width=1280,height=720');
 $('projection-note').textContent=projectionWindow?'Projection window opened. Move it onto the projector, then click Full screen there. Keep this admin open.':'The popup was blocked. Allow popups for this page and try again.';
});
function syncLibrary(incoming){try{const next=M.parseBackup(JSON.stringify({version:2,moments:incoming}));moments=next;renderMoments();if(!dirty)fillEditor(moments.find(m=>m.id===selectedId)||moments[0]);else editorSelection()}catch{}}
function syncPreferences(incoming){if(Number.isFinite(incoming?.sensitivity))settings.sensitivity=Math.min(100,Math.max(0,incoming.sensitivity));settings.gentle=matchMedia('(prefers-reduced-motion: reduce)').matches||!!incoming?.gentle;$('sensitivity').value=settings.sensitivity;$('sensitivity-value').textContent=settings.sensitivity+'%';$('gentle').checked=settings.gentle;document.body.classList.toggle('gentle',settings.gentle)}
if(channel)channel.onmessage=({data})=>{
 if(data?.type==='hello'&&!isScreen){send({type:'playback',playback});send({type:'preferences',settings});send({type:'library',moments});send({type:'celebration',event:celebrationEvent})}
 if(data?.type==='playback'){const next=validPlayback(data.playback);if(next){playback=next;sceneKey='';lastCountdown=-1;updatePlayback(Date.now())}}
 if(data?.type==='celebration')receiveCelebration(data.event);
 if(data?.type==='preferences')syncPreferences(data.settings);
 if(data?.type==='library')syncLibrary(data.moments);
 if(data?.type==='sound'&&isScreen){lastRemoteFrame=performance.now();mode=data.mode;level=data.level;bass=data.bass;pulse=data.pulse;bands=data.bands;stageStatus(mode==='mic'?'Following the speakers':mode==='demo'?'Preview rhythm · no microphone':'Ready when you are')}
};
window.addEventListener('storage',e=>{try{if(e.key===FX_KEY)receiveCelebration(JSON.parse(e.newValue));if(e.key===RUNTIME){const next=validPlayback(JSON.parse(e.newValue));if(next){playback=next;sceneKey='';lastCountdown=-1;updatePlayback(Date.now())}}if(e.key===LIBRARY)syncLibrary(JSON.parse(e.newValue).moments);if(e.key===PREFS)syncPreferences(JSON.parse(e.newValue))}catch{}});
window.addEventListener('pagehide',()=>{attempt++;releaseAudio();if(!isScreen)send({type:'sound',mode:'idle',level:0,bass:0,pulse:0,bands:Array(40).fill(0)})});
function resize(){const rect=stage.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
new ResizeObserver(resize).observe(stage);

function sound(t,dt){
 if(isScreen&&mode!=='demo'){if(performance.now()-lastRemoteFrame>1800){mode='idle';level*=Math.exp(-dt*5);bass*=Math.exp(-dt*5);pulse*=Math.exp(-dt*5);bands=bands.map(v=>v*Math.exp(-dt*5));stageStatus('Waiting for Party desk')}return}
 const gain=.7+settings.sensitivity/100*6;
 if(mode==='mic'&&analyser){
  analyser.getByteFrequencyData(freq);analyser.getFloatTimeDomainData(waveform);
  let square=0;for(const v of waveform)square+=v*v;
  const rms=Math.sqrt(square/waveform.length);
  const bin=audioContext.sampleRate/analyser.fftSize;
  let sum=0,n=0;for(let i=Math.ceil(45/bin);i<=Math.floor(190/bin);i++){sum+=freq[i]/255;n++}
  const rawBass=n?sum/n:0;
  level=Math.min(1,rms*gain*3.5);
  bass=Math.min(1,rawBass*(.45+gain*.22))*Math.min(1,level*7);
  for(let i=0;i<bands.length;i++){const index=Math.min(freq.length-1,Math.round(2*Math.pow(170,i/(bands.length-1))));bands[i]+=(Math.min(1,freq[index]/255*gain*.4)-bands[i])*.25}
 }else if(mode==='demo'){
  const beat=Math.pow(Math.max(0,Math.cos(t*Math.PI*4)),12);
  bass=.12+.72*beat;level=.20+.35*beat;
  bands=bands.map((v,i)=>.12+.6*Math.pow(Math.max(0,Math.sin(i*.38+t*3)),2)*(beat*.65+.35));
 }else{level*=Math.exp(-dt*9);bass*=Math.exp(-dt*9);bands=bands.map(v=>v*Math.exp(-dt*9))}
 bassAverage+=(bass-bassAverage)*(1-Math.exp(-dt*2));
 if(mode!=='idle'&&level>.035&&bass>Math.max(.14,bassAverage*1.18)&&bass-previousBass>.035&&t-lastBeat>.38){pulse=Math.max(pulse,.8);lastBeat=t}
 previousBass=bass;pulse*=Math.exp(-dt*4.3);
 const percentage=Math.round(level*100);$('meter-fill').style.width=percentage+'%';$('meter-value').textContent=percentage+'%';document.querySelector('.meter').setAttribute('aria-valuenow',String(percentage));
}
function draw(ms){requestAnimationFrame(draw);if(ms-lastTime<16)return;const dt=Math.min(.05,(ms-lastTime)/1000||.016);lastTime=ms;const t=ms/1000;
 updatePlayback(Date.now());
 const scene=playback.scene,p=palettes[scene.palette],strength=scene.intensity/100,motion=settings.gentle ? .15 : 1;
 const reactive=Math.min(1,pulse*.65+bass*.35)*strength;
 stage.style.setProperty('--word-scale',String(1+reactive*.022*motion));stage.style.setProperty('--glow',String(reactive));
 ctx.clearRect(0,0,width,height);ctx.fillStyle=p.background;ctx.fillRect(0,0,width,height);
 const colour=(rgb,a)=>`rgba(${rgb.join(',')},${a})`;
 const ambient=ctx.createRadialGradient(width*.5,height*.5,0,width*.5,height*.5,width*.7);ambient.addColorStop(0,colour(p.rgb,.06+reactive*.13));ambient.addColorStop(1,colour(p.rgb,0));ctx.fillStyle=ambient;ctx.fillRect(0,0,width,height);
 ctx.save();ctx.globalCompositeOperation='screen';
 if(scene.effect==='beams'){
  for(let i=0;i<6;i++){
   const origin=i%2===0?-width*.12:width*1.12;
   const end=width*(.13+i*.15)+Math.sin(t*.22*motion+i)*width*.18*motion;
   const spread=width*(.035+reactive*.02);
   const gradient=ctx.createLinearGradient(origin,height*.98,end,height*.08);gradient.addColorStop(0,colour(p.rgb,(.12+reactive*.24)*strength));gradient.addColorStop(1,colour(p.secondary,0));ctx.fillStyle=gradient;
   ctx.beginPath();ctx.moveTo(origin,height*1.05);ctx.lineTo(end-spread,-height*.1);ctx.lineTo(end+spread,-height*.1);ctx.closePath();ctx.fill();
  }
 }else if(scene.effect==='halo'){
  for(let i=0;i<5;i++){
   const radius=Math.min(width,height)*(.23+i*.075+reactive*.035*motion);
   ctx.beginPath();ctx.ellipse(width*.5,height*.48,radius*1.4,radius,Math.sin(t*.14*motion)*.12,0,Math.PI*2);ctx.strokeStyle=colour(i%2?p.rgb:p.secondary,(.10+reactive*.26)*strength);ctx.lineWidth=(i===0?4:1.5)+reactive*3;ctx.shadowColor=colour(p.rgb,.7);ctx.shadowBlur=15*strength;ctx.stroke();
  }
  ctx.shadowBlur=0;
 }else if(scene.effect==='bars'){
  const gap=width/40;
  for(let i=0;i<40;i++){
   const bar=Math.min(height*.72,(.05+bands[i]*.62)*height);
   const gradient=ctx.createLinearGradient(0,height,0,height-bar);gradient.addColorStop(0,colour(p.rgb,(.24+reactive*.2)*strength));gradient.addColorStop(1,colour(p.secondary,.08*strength));ctx.fillStyle=gradient;ctx.fillRect(i*gap+gap*.22,height-bar,gap*.56,bar);
  }
 }
 if(scene.effect==='confetti'){
  for(let i=0;i<65;i++){
   const x=((i*137.508)%1000)/1000*width+Math.sin(t*.6*motion+i)*width*.018;
   const y=((i*79.17+t*(28+i%17)*motion)%(height+40))-20;
   const size=3+i%4;
   ctx.save();ctx.translate(x,y);ctx.rotate(i+t*.6*motion);ctx.fillStyle=colour(i%3?p.rgb:p.secondary,(.25+reactive*.5)*strength);ctx.fillRect(-size/2,-size/2,size,size*1.8);ctx.restore();
  }
 }
 // Slow LED rails provide visible idle motion without flashing the whole screen.
 for(let edge of [.018,.982])for(let i=0;i<26;i++){
  const a=(.08+.21*(.5+.5*Math.sin(i*.3-t*.65*motion))+reactive*.2)*strength;
  ctx.fillStyle=colour(p.rgb,a);ctx.fillRect(width*edge-2,height*(.10+i*.030),4,height*.018);
 }
 ctx.restore();
}

if(isScreen){document.body.classList.add('screen-only');document.title='Level Eleven · Projection';$('leave-projector').textContent='Full screen · F';send({type:'hello'});wake()}
// Scene deadlines and microphone analysis must keep running when the admin
// window is behind the projection. Animation frames can pause in hidden tabs.
let lastSoundTick=performance.now();
function tick(){const now=performance.now(),dt=Math.min(1,(now-lastSoundTick)/1000);lastSoundTick=now;updatePlayback(Date.now());sound(now/1000,dt);if(!isScreen)send({type:'sound',mode,level,bass,pulse,bands})}
initControls();resize();setInterval(tick,50);requestAnimationFrame(draw);
