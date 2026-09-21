const {createHmac} = require('node:crypto');
module.exports = async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)return res.status(503).json({error:'Lista ainda não disponível.'});
  try{
    if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Origem não permitida.'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body.email!=='string'||body.consent!==true)return res.status(400).json({error:'Cadastro inválido.'});
    if(body.website)return res.status(400).json({error:'Cadastro inválido.'});
    const email=body.email.trim().toLowerCase();
    if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'E-mail inválido.'});
    async function redis(command){const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('storage');const data=await r.json();if(data.error)throw new Error('storage');return data.result;}
    const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
    const digest=createHmac('sha256',token).update(ip).digest('hex');
    const attempts=await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n",1,'duck:subscribe:limit:'+digest]);
    if(Number(attempts)>10)return res.status(429).json({error:'Tente novamente mais tarde.'});
    await redis(['HSETNX','duck:launch:subscribers:v1',email,JSON.stringify({createdAt:new Date().toISOString(),consent:'launch-notice-v1'})]);
    return res.status(200).json({ok:true});
  }catch(e){return res.status(503).json({error:'Não foi possível cadastrar agora.'});}
};
