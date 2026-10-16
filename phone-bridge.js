// The laptop remains the show authority. Phones send short commands only.
if(!isScreen){
 const hostId=crypto.randomUUID(),acknowledgements=[];let phoneToken='',bridgeBusy=false;
 async function pairHost(){
  try{const r=await fetch('/api/pair');if(!r.ok)throw Error();const data=await r.json();phoneToken=data.token;
   $('phone-pin').textContent=data.pin;$('phone-links').replaceChildren();
   for(const url of data.urls){const a=document.createElement('a');a.href=url;a.textContent=url;a.target='_blank';a.rel='noopener';$('phone-links').append(a)}
   $('phone-help').textContent=data.urls.length?'On your phone, join the same Wi-Fi, open this address and enter the code.':'Connect the laptop to Wi-Fi, then reload to get a phone address.';
  }catch{$('phone-help').textContent='Restart Start Party Screen.command to enable phone control.'}
 }
 async function bridge(){if(bridgeBusy||!phoneToken)return;bridgeBusy=true;
  try{
   const r=await fetch('/api/host',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+phoneToken},body:JSON.stringify({hostId,state:{moments,playback,celebration:celebrationEvent,effects:M.celebrations,acks:acknowledgements}})});
   if(!r.ok){const error=await r.json();if(r.status===401){phoneToken='';await pairHost()}throw Error(error.error||'Connection interrupted.')}
   const data=await r.json();$('phone-connection').textContent='Phone controls ready';
   for(const c of data.commands){if(acknowledgements.some(a=>a.id===c.id))continue;let error='';
    try{if(c.command==='moment'){const scene=moments.find(m=>m.id===c.value);if(!scene)throw Error('Moment no longer exists.');launch(scene)}
     else if(c.command==='effect'){if(!Object.hasOwn(M.celebrations,c.value)||c.value==='none')throw Error('Effect not found.');fireCelebration(c.value)}
     else if(c.command==='clear')fireCelebration('none');else if(c.command==='return')returnNow();
    }catch(e){error=e.message}
    acknowledgements.push({id:c.id,error});if(acknowledgements.length>50)acknowledgements.shift();
   }
  }catch(e){$('phone-connection').textContent=e.message||'Phone connection interrupted.'}finally{bridgeBusy=false}
 }
 pairHost().then(bridge);setInterval(bridge,400);
}
