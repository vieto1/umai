/* UMAI private cloud sync — authenticated users only; local recipes remain available offline. */
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const client=createClient('https://carwwhojzwhxhygzcevf.supabase.co','sb_publishable_qAebBza10UK0q7zM_JCigw_IvOd4Q00',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,loading=false,applying=false,saveTimer=null,cloudReady=false;
const box=document.createElement('div');
box.id='umai-cloud-panel';
box.innerHTML='<div class="umai-cloud-head"><strong>☁ UMAI Cloud</strong><button type="button" id="umai-cloud-close" aria-label="Schließen">×</button></div><p id="umai-cloud-status">Verbindung wird geprüft …</p><form id="umai-cloud-login"><label for="umai-cloud-email">E-Mail-Adresse</label><input id="umai-cloud-email" type="email" autocomplete="email" placeholder="deine@email.de" required><label for="umai-cloud-password">Passwort</label><input id="umai-cloud-password" type="password" autocomplete="current-password" minlength="8" required placeholder="Mindestens 8 Zeichen"><button type="submit">Mit Passwort anmelden</button></form><div id="umai-cloud-signed" hidden><button type="button" id="umai-cloud-sync">Jetzt synchronisieren</button><button type="button" id="umai-cloud-logout">Abmelden</button></div><small>Private Rezepte und Bilder werden nur nach Anmeldung synchronisiert. Melde dich auf jedem Gerät mit deinem UMAI-Konto an. Die Konten müssen zunächst eingerichtet werden.</small>';
box.hidden=true;document.body.appendChild(box);
const open=document.createElement('button');open.className='ghost umai-cloud-trigger';open.type='button';open.textContent='☁ Cloud';open.title='UMAI Cloud-Synchronisierung';document.querySelector('.washi-actions')?.prepend(open);
const status=document.getElementById('umai-cloud-status'),login=document.getElementById('umai-cloud-login'),signed=document.getElementById('umai-cloud-signed');
const showStatus=s=>{status.textContent=s};
open.addEventListener('click',()=>{box.hidden=!box.hidden});
document.getElementById('umai-cloud-close').onclick=()=>box.hidden=true;
const updateAuth=()=>{login.hidden=!!user;signed.hidden=!user;open.textContent=user?'☁ Verbunden':'☁ Cloud';showStatus(user?'Verbunden: '+(user.email||'Konto'):'Nicht angemeldet – lokale Rezepte bleiben erhalten. Für den ersten Zugang muss ein UMAI-Konto eingerichtet werden.')};
login.addEventListener('submit',async e=>{
 e.preventDefault();
 const button=login.querySelector('button[type="submit"]');
 const email=document.getElementById('umai-cloud-email').value.trim();
 const password=document.getElementById('umai-cloud-password').value;
 button.disabled=true;showStatus('Anmeldung wird geprüft …');
 try{const {error}=await client.auth.signInWithPassword({email,password});
 if(error)showStatus('Anmeldung fehlgeschlagen: '+(error.message==='Invalid login credentials'?'E-Mail oder Passwort stimmt nicht oder das Konto ist noch nicht eingerichtet.':error.message));
 else showStatus('Erfolgreich angemeldet. Synchronisierung startet …');
 }catch(err){showStatus('Verbindungsfehler: '+err.message)}
 finally{button.disabled=false;document.getElementById('umai-cloud-password').value=''}
});
function isCloudImage(value){return typeof value==='string'&&value.startsWith('umai-storage:')}
async function signedImage(path){const {data,error}=await client.storage.from('umai-images').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl}
async function uploadDataImage(dataUrl,folder){if(!dataUrl?.startsWith('data:image/'))return dataUrl;const blob=await(await fetch(dataUrl)).blob();if(blob.size>5*1024*1024)throw Error('Bild über 5 MB');const ext=blob.type==='image/webp'?'webp':'jpg';const path=user.id+'/'+folder+'/'+crypto.randomUUID()+'.'+ext;const {error}=await client.storage.from('umai-images').upload(path,blob,{contentType:blob.type,upsert:false});if(error)throw error;return 'umai-storage:'+path}
async function normalizeIncoming(r){const copy={...r};if(isCloudImage(copy.image)){copy.cloudImagePath=copy.image.slice(13);try{copy.image=await signedImage(copy.cloudImagePath)}catch{copy.image='assets/recipe-placeholder.svg'}}return copy}
async function loadRemote(){if(!user||loading)return;loading=true;try{
 const {data,error}=await client.from('umai_recipes').select('id,content,updated_at').eq('owner_id',user.id);
 if(error)throw error;
 const local=JSON.parse(localStorage.getItem('umai-recipes')||'[]');
 if(!data.length){showStatus('Erste Synchronisierung: lokale Rezepte werden hochgeladen …');await uploadRecipes(local);return}
 const remote=await Promise.all(data.map(x=>normalizeIncoming(x.content)));const missing=local.filter(r=>!remote.some(c=>c.id===r.id));if(missing.length){await uploadRecipes(missing);remote.push(...missing)}
 // Cloud is canonical once populated; starter recipes absent remotely are not silently restored.
 applying=true;recipes=remote;localStorage.setItem('umai-recipes',JSON.stringify(remote));render();applying=false;
 const pref=await client.from('umai_preferences').select('content').eq('owner_id',user.id).maybeSingle();
 if(pref.data?.content){const p=pref.data.content;if(p.hero){let hero={...p.hero};if(isCloudImage(hero.image)){hero.cloudImagePath=hero.image.slice(13);try{hero.image=await signedImage(hero.cloudImagePath)}catch{}}umaiHeroState=hero;applyHeroSettings();localStorage.setItem('umai-hero-preferences-v1',JSON.stringify(hero))}}
 showStatus('Synchronisiert · '+new Date().toLocaleTimeString('de-DE'));
 }catch(e){showStatus('Cloud-Synchronisierung fehlgeschlagen: '+e.message)}finally{loading=false;applying=false}}
async function uploadRecipes(list){if(!user||applying)return;const rows=[];for(const r of list){const copy={...r};if(copy.image?.startsWith('data:image/')){copy.image=await uploadDataImage(copy.image,'recipes');copy.cloudImagePath=copy.image.slice(13)}else if(copy.cloudImagePath&&copy.image?.startsWith('http'))copy.image='umai-storage:'+copy.cloudImagePath;rows.push({id:copy.id,owner_id:user.id,content:copy,updated_at:new Date().toISOString()})}if(rows.length){const {error}=await client.from('umai_recipes').upsert(rows,{onConflict:'owner_id,id'});if(error)throw error}showStatus('Rezepte in der Cloud gespeichert · '+new Date().toLocaleTimeString('de-DE'))}
window.umaiCloudSaveRecipes=list=>{if(!user||applying)return;clearTimeout(saveTimer);const snapshot=structuredClone(list);saveTimer=setTimeout(async()=>{saveTimer=null;try{await uploadRecipes(snapshot)}catch(e){showStatus('Speichern fehlgeschlagen: '+e.message)}},450)};
window.umaiCloudSavePreferences=async p=>{if(!user||applying)return;try{const hero={...p};if(hero.image?.startsWith('data:image/')){hero.image=await uploadDataImage(hero.image,'backgrounds');hero.cloudImagePath=hero.image.slice(13)}else if(hero.cloudImagePath&&hero.image?.startsWith('http'))hero.image='umai-storage:'+hero.cloudImagePath;const {error}=await client.from('umai_preferences').upsert({owner_id:user.id,content:{hero},updated_at:new Date().toISOString()},{onConflict:'owner_id'});if(error)throw error;showStatus('Hintergrundbild in Cloud gespeichert')}catch(e){showStatus('Hintergrundbild nicht synchronisiert: '+e.message)}};
document.getElementById('umai-cloud-sync').onclick=()=>loadRemote();
document.getElementById('umai-cloud-logout').onclick=async()=>{await client.auth.signOut();user=null;updateAuth()};
client.auth.onAuthStateChange((event,session)=>{const next=session?.user||null;const changed=next?.id!==user?.id;user=next;updateAuth();if(user&&changed)setTimeout(loadRemote,0)});
const initial=await client.auth.getUser();user=initial.data.user||null;updateAuth();if(user)await loadRemote();
window.addEventListener('online',()=>{if(user)loadRemote()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)loadRemote()});
setInterval(()=>{if(user&&!document.hidden&&!saveTimer)loadRemote()},30000);
