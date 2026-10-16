const {test}=require('node:test');
const assert=require('node:assert/strict');
let M; try {M=require('../moments.js')} catch {M={}}
const welcome={id:'welcome',name:'Welcome',message:'HELLO',tagline:'Welcome',intro:'Your night',palette:'pink',effect:'beams',typeface:'solid',intensity:40,duration:0,kind:'scene'};
const birthday={...welcome,id:'birthday',name:'Birthday',message:'HAPPY BIRTHDAY',palette:'dream',effect:'confetti',typeface:'outline',intensity:80,duration:6};
test('a temporary moment changes the full scene and restores its previous look when it ends',()=>{
 assert.equal(typeof M.startPlayback,'function','Moment playback is not implemented');
 const base=M.startPlayback(welcome,null,1000);
 const live=M.startPlayback(birthday,base,2000);
 assert.deepEqual([live.scene.palette,live.scene.effect,live.scene.typeface,live.scene.intensity],['dream','confetti','outline',80]);
 assert.equal(M.resolvePlayback(live,7999).scene.id,'birthday');
 const restored=M.resolvePlayback(live,8000);
 assert.deepEqual([restored.scene.id,restored.scene.palette,restored.scene.effect,restored.scene.intensity],['welcome','pink','beams',40]);
});
test('interrupting a countdown prevents its previous return from replacing the new moment',()=>{
 assert.equal(typeof M.startPlayback,'function','Moment playback is not implemented');
 const base=M.startPlayback(welcome,null,0);
 const countdown=M.startPlayback({...birthday,kind:'countdown'},base,1000);
 assert.equal(M.displayWords(countdown,1000).message,'3');
 assert.equal(M.displayWords(countdown,3000).message,'1');
 assert.equal(M.displayWords(countdown,4000).message,'LET’S GO!');
 const replaced=M.startPlayback({...birthday,duration:0},countdown,4200);
 assert.equal(M.resolvePlayback(replaced,12000).scene.id,'birthday');
});
test('nested temporary moments return to the held scene rather than replaying an interrupted countdown',()=>{
 assert.equal(typeof M.startPlayback,'function','Moment playback is not implemented');
 const base=M.startPlayback(welcome,null,0);
 const countdown=M.startPlayback({...birthday,kind:'countdown'},base,1000);
 const next=M.startPlayback(birthday,countdown,2000);
 assert.equal(M.resolvePlayback(next,8000).scene.id,'welcome');
});
test('invalid imports are rejected and cannot silently replace saved moments',()=>{
 assert.equal(typeof M.parseBackup,'function','Moment import is not implemented');
 assert.throws(()=>M.parseBackup('{broken'),/valid|JSON/i);
 assert.throws(()=>M.parseBackup(JSON.stringify({version:2,moments:[]})),/one|empty/i);
 assert.throws(()=>M.parseBackup(JSON.stringify({version:2,moments:[{...welcome,effect:'unknown'}]})),/effect/i);
 assert.throws(()=>M.parseBackup(JSON.stringify({version:2,moments:[welcome,welcome]})),/duplicate/i);
 const data=M.parseBackup(JSON.stringify({version:2,moments:[welcome,birthday]}));
 assert.deepEqual(data.map(m=>m.id),['welcome','birthday']);
});
test('celebration settings survive backups and older moments gain valid defaults',()=>{
 const old=M.validateMoment(welcome);assert.equal(old.celebration,'none');
 const configured=M.validateMoment({...birthday,celebration:'stars',burstDuration:9,amount:80,speed:120});
 const restored=M.parseBackup(JSON.stringify({version:2,moments:[configured]}))[0];
 assert.deepEqual([restored.celebration,restored.burstDuration,restored.amount,restored.speed],['stars',9,80,120]);
 assert.throws(()=>M.validateMoment({...birthday,celebration:'unknown'}),/celebration/i);
 assert.throws(()=>M.validateMoment({...birthday,burstDuration:-2}),/duration/i);
});
