import { put, get, del } from '@vercel/blob';
import { createHash } from 'node:crypto';

const MAX_CIPHERTEXT_CHARS = 3200000;

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}
function validToken(token){return typeof token==='string' && /^[A-Za-z0-9_-]{40,100}$/.test(token)}
function pathname(token){return 'untold-backups/v1/'+createHash('sha256').update(token).digest('hex')+'.json'}
async function streamToText(stream){return await new Response(stream).text()}

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return json(res,400,{error:'Invalid JSON'})}}
  const {action,token,payload}=body||{};
  if(!validToken(token)) return json(res,400,{error:'Invalid backup token'});
  const path=pathname(token);
  try{
    if(action==='put'){
      if(!payload || payload.schema!==1 || typeof payload.iv!=='string' || typeof payload.ciphertext!=='string') return json(res,400,{error:'Invalid encrypted backup'});
      if(payload.ciphertext.length>MAX_CIPHERTEXT_CHARS) return json(res,413,{error:'Backup is too large'});
      const safe={schema:1,app:'Untold Seizure Log',appVersion:String(payload.appVersion||'').slice(0,60),savedAt:Number(payload.savedAt)||Date.now(),iv:String(payload.iv),ciphertext:String(payload.ciphertext)};
      await put(path,JSON.stringify(safe),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
      return json(res,200,{ok:true,savedAt:safe.savedAt});
    }
    if(action==='get'){
      const result=await get(path,{access:'private',useCache:false});
      if(!result || result.statusCode!==200 || !result.stream) return json(res,404,{error:'No cloud backup was found for this recovery code'});
      const text=await streamToText(result.stream);
      let saved; try{saved=JSON.parse(text)}catch{return json(res,500,{error:'Stored backup is unreadable'})}
      return json(res,200,{ok:true,payload:saved});
    }
    if(action==='delete'){
      await del(path);
      return json(res,200,{ok:true});
    }
    return json(res,400,{error:'Unknown backup action'});
  }catch(e){
    const msg=String(e?.message||e||'Backup service error');
    if(/not found/i.test(msg)) return json(res,404,{error:'No cloud backup was found for this recovery code'});
    return json(res,500,{error:'Backup service is temporarily unavailable'});
  }
}