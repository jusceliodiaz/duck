const { timingSafeEqual, createHmac } = require('node:crypto');

// Credentials stay in Vercel environment variables; never ship them to the browser.
module.exports = async function regions(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const adminKey = process.env.REGIONS_ADMIN_KEY;
  const configured = Boolean(url && token && adminKey);
  const reply = (status, body) => res.status(status).json(body);
  if (req.method === 'GET' && req.query && req.query.status === '1') return reply(200, { enabled: configured });
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(405, {error:'Método não permitido.'}); }
  if (!configured) return reply(503, { error: 'Coleta de regiões ainda não configurada.' });
  async function redis(command) {
    const response = await fetch(url, {method:'POST', headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}, body:JSON.stringify(command), signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('storage');
    const data = await response.json();
    if (data.error) throw new Error('storage');
    return data.result;
  }
  try {
    if (req.method === 'GET') {
      const supplied = Buffer.from(req.headers.authorization || '');
      const expected = Buffer.from('Bearer '+adminKey);
      if(supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401,{error:'Chave de acesso inválida.'});
      const data = await redis(['HGETALL','duck:regions:v1']);
      const rows = [];
      for(let i=0; i<(data || []).length; i+=2) {
        const [month, city, uf] = data[i].split('|');
        rows.push({month,city,uf,count:Number(data[i+1])});
      }
      rows.sort((a,b)=>b.month.localeCompare(a.month) || b.count-a.count);
      return reply(200,{rows});
    }
    // No cross-origin collection. The submitted CEP is resolved server-side.
    const origin = req.headers.origin;
    if (!origin || new URL(origin).host !== req.headers.host) return reply(403,{error:'Origem não permitida.'});
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || body.consent !== true || !/^\d{8}$/.test(body.cep || '')) return reply(400,{error:'Informe um CEP válido e autorize o compartilhamento.'});
    // Limit repeat submissions; only a keyed digest is retained for one day.
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const digest = createHmac('sha256',adminKey).update(ip || 'unknown').digest('hex');
    const limitKey = 'duck:regions:limit:'+digest;
    const attempts = await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],86400) end; return n",1,limitKey]);
    if (Number(attempts)>10) return reply(429,{error:'Limite de envios atingido. Sua região continua salva neste navegador.'});
    const lookup = await fetch('https://viacep.com.br/ws/'+body.cep+'/json/',{signal:AbortSignal.timeout(5000)});
    if (!lookup.ok) throw new Error('lookup');
    const place = await lookup.json();
    if(place.erro || !place.localidade || !place.uf) return reply(400,{error:'CEP não encontrado.'});
    const month = new Date().toISOString().slice(0,7);
    const field = month+'|'+place.localidade+'|'+place.uf;
    await redis(['HINCRBY','duck:regions:v1',field,1]);
    // Store aggregate city counts, never the submitted full CEP or address.
    return reply(200,{ok:true});
  } catch(e) { return reply(503,{error:'Não foi possível registrar a região agora.'}); }
};
