import webpush from 'web-push';

export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='GET'){
    res.statusCode=405;
    return res.end(JSON.stringify({error:'Method not allowed'}));
  }
  const keys=webpush.generateVAPIDKeys();
  res.statusCode=200;
  res.end(JSON.stringify(keys));
}