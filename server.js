const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.OTP_FROM_EMAIL || '';
const ALLOWED_EMAIL = 'alihasan8069@gmail.com';
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const sessions = new Map();
const sends = new Map();

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(data);
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function randomOtp() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
function randomId() { return crypto.randomBytes(24).toString('hex'); }
function readBody(req) { return new Promise((resolve, reject) => { let s=''; req.on('data',c=>{s+=c;if(s.length>10000) reject(new Error('Request too large.'));}); req.on('end',()=>{try{resolve(JSON.parse(s||'{}'));}catch(e){reject(new Error('Invalid JSON.'));}}); req.on('error',reject); }); }
async function sendEmail(otp) {
  if (!RESEND_API_KEY || !FROM_EMAIL) throw new Error('OTP email service is not configured. Set RESEND_API_KEY and OTP_FROM_EMAIL on the server.');
  const r = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{'Authorization':`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from: FROM_EMAIL,
      to: [ALLOWED_EMAIL],
      subject: 'Website APK Studio verification code',
      html: `<div style="font-family:Arial,sans-serif"><h2>Website APK Studio</h2><p>Your one-time verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in 5 minutes. If you did not request it, you can ignore this email.</p></div>`,
      text: `Website APK Studio verification code: ${otp}. This code expires in 5 minutes.`
    })
  });
  if (!r.ok) { const t=await r.text(); throw new Error(`Email provider error (${r.status}): ${t.slice(0,300)}`); }
}
async function handler(req,res) {
  if (req.method === 'OPTIONS') return json(res,204,{});
  if (req.method !== 'POST' || req.url !== '/otp') return json(res,404,{ok:false,error:'Not found.'});
  try {
    const body=await readBody(req);
    if(body.email !== ALLOWED_EMAIL) return json(res,403,{ok:false,error:'Email is not authorized.'});
    if(body.action === 'send') {
      const last=sends.get(ALLOWED_EMAIL)||0;
      if(Date.now()-last < RESEND_COOLDOWN_MS) return json(res,429,{ok:false,error:'Please wait before requesting another OTP.'});
      const otp=randomOtp();
      const sessionId=randomId();
      await sendEmail(otp);
      sessions.set(sessionId,{otpHash:hash(otp),expiresAt:Date.now()+OTP_TTL_MS,attempts:0});
      sends.set(ALLOWED_EMAIL,Date.now());
      return json(res,200,{ok:true,sessionId,expiresIn:300});
    }
    if(body.action === 'verify') {
      const s=sessions.get(String(body.sessionId||''));
      if(!s) return json(res,400,{ok:false,error:'OTP session is invalid or expired.'});
      if(Date.now()>s.expiresAt){sessions.delete(body.sessionId);return json(res,400,{ok:false,error:'OTP has expired.'});}
      if(++s.attempts>MAX_ATTEMPTS){sessions.delete(body.sessionId);return json(res,429,{ok:false,error:'Too many incorrect attempts.'});}
      if(!/^\d{6}$/.test(String(body.code||'')) || !crypto.timingSafeEqual(Buffer.from(s.otpHash),Buffer.from(hash(String(body.code))))){
        return json(res,400,{ok:false,error:'Incorrect OTP.'});
      }
      sessions.delete(body.sessionId);
      return json(res,200,{ok:true});
    }
    return json(res,400,{ok:false,error:'Unknown action.'});
  } catch(e) { return json(res,500,{ok:false,error:e.message}); }
}
setInterval(()=>{const now=Date.now();for(const [id,s] of sessions)if(s.expiresAt<now)sessions.delete(id);},60000).unref();
http.createServer(handler).listen(PORT,()=>console.log(`OTP server listening on http://localhost:${PORT}/otp`));
