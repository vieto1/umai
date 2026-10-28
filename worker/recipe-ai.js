/**
 * UMAI AI recipe endpoint – Cloudflare Worker.
 * Required secret: OPENAI_API_KEY (set with wrangler secret put OPENAI_API_KEY)
 * Required variable: ALLOWED_ORIGIN=https://vieto1.github.io
 * Optional: OPENAI_MODEL (default gpt-4o-mini)
 * Before sharing publicly, enable Cloudflare WAF/rate limiting on this route.
 */
const SYSTEM = `Du bist Rezeptentwickler für UMAI, eine deutsche Rezept-App. Verarbeite ungeordnete Koch-Notizen zu einem vollständigen, realistischen Rezept. Antworte AUSSCHLIESSLICH als valides JSON-Objekt mit den Feldern: title (string), description (string), category (string), time (integer, Gesamtminuten), activeTime (integer), difficulty (Leicht|Mittel|Anspruchsvoll), servings (integer), ingredients (Array von Strings), steps (Array von Strings), notes (Array von Strings). Zutaten: sinnvolle Abschnittsüberschriften als EIGENE Strings in GROSSBUCHSTABEN vor den jeweiligen Zutaten, z.B. GEMÜSE & KRÄUTER, SAUCE & GEWÜRZE, FLEISCH, TROCKENWARE. Zutatenmengen in g/ml plus Haushaltsmaß, sofern sinnvoll. Unbekannte Mengen deutlich mit [geschätzt] kennzeichnen. Schritte mit Zeit, Temperatur, Gargrad und sinnvollen Parallel-Hinweisen; ergänzte Zeitwerte mit [geschätzt] markieren. Gesamtzeit einschließlich Wartezeiten plausibel bestimmen. Erfinde keine sicheren Kerntemperaturen für Zutaten, die du nicht kennst. Maximal 30 Zutaten und 24 Schritte. Antworte auf Deutsch.`;
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://vieto1.github.io';
  const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
  if(origin!==allowed)return new Response('Origin nicht erlaubt',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:cors});
  if(!env.OPENAI_API_KEY)return new Response(JSON.stringify({error:'KI-Schlüssel ist serverseitig noch nicht konfiguriert.'}),{status:503,headers:{...cors,'Content-Type':'application/json'}});
  if(Number(request.headers.get('content-length')||0)>20000)return new Response('Eingabe zu groß',{status:413,headers:cors});
  try{
   const body=await request.json(), notes=String(body.notes||'').trim();
   if(notes.length<15||notes.length>6000)return new Response(JSON.stringify({error:'Bitte 15 bis 6000 Zeichen Rezeptnotizen eingeben.'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});
   const upstream=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4o-mini',temperature:0.3,response_format:{type:'json_object'},messages:[{role:'system',content:SYSTEM},{role:'user',content:notes}]})});
   if(!upstream.ok){return new Response(JSON.stringify({error:'Der KI-Dienst ist derzeit nicht verfügbar.'}),{status:502,headers:{...cors,'Content-Type':'application/json'}})}
   const data=await upstream.json(),recipe=JSON.parse(data.choices?.[0]?.message?.content||'{}');
   if(typeof recipe.title!=='string'||!Array.isArray(recipe.ingredients)||!Array.isArray(recipe.steps)||!recipe.steps.length)throw Error('Ungültige Antwort');
   return new Response(JSON.stringify({recipe}),{status:200,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  }catch(e){return new Response(JSON.stringify({error:'Rezept konnte nicht verarbeitet werden. Bitte erneut versuchen.'}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}
 }
};