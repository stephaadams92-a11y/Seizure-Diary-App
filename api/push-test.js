import webpush from 'web-push';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export const config={maxDuration:30};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST'){
    res.statusCode=405;
    return res.end(JSON.stringify({error:'Method not allowed'}));
  }
  let body=req.body;
  if(typeof body==='string'){
    try{body=JSON.parse(body)}catch{
      res.statusCode=400;
      return res.end(JSON.stringify({error:'Invalid JSON'}));
    }
  }
  const {subscription,publicKey,privateKey}=body||{};
  const delayMs=Math.max(3000,Math.min(15000,Number(body?.delayMs)||10000));
  if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth||!publicKey||!privateKey){
    res.statusCode=400;
    return res.end(JSON.stringify({error:'Missing push test details'}));
  }
  try{
    webpush.setVapidDetails('mailto:stephaadams92@gmail.com',publicKey,privateKey);
    await sleep(delayMs);
    await webpush.sendNotification(subscription,JSON.stringify({
      title:'Untold Seizure Log',
      body:'Standby push test — this notification was sent from Vercel while the app was not active.',
      tag:'untold-standby-test',
      url:'/'
    }),{TTL:60,urgency:'high'});
    res.statusCode=200;
    return res.end(JSON.stringify({ok:true,sentAt:Date.now()}));
  }catch(e){
    console.error('Standby push test failed',e);
    res.statusCode=500;
    return res.end(JSON.stringify({error:'Standby push test failed'}));
  }
}