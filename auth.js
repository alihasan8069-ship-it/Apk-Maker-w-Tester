const AUTH_EMAIL = 'alihasan8069@gmail.com';
const authOverlay = document.getElementById('authOverlay');
const authEmail = document.getElementById('authEmail');
const authOtp = document.getElementById('authOtp');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const authMessage = document.getElementById('authMessage');
const otpRow = document.getElementById('otpRow');
let authSessionId = '';

authEmail.textContent = AUTH_EMAIL;

function authMsg(message, good=false){ authMessage.textContent=message; authMessage.className=good?'auth-message good':'auth-message'; }

sendOtpBtn.onclick = async () => {
  sendOtpBtn.disabled=true;
  authMsg('Sending a one-time code…');
  const r=await window.studioAPI.authSendOtp();
  if(r.ok){
    authSessionId=r.sessionId;
    otpRow.classList.remove('hidden');
    authOtp.focus();
    authMsg(`OTP sent to ${r.maskedEmail}. It expires in 5 minutes.`,true);
    setTimeout(()=>{sendOtpBtn.disabled=false},30000);
  } else {
    authMsg(r.error);
    sendOtpBtn.disabled=false;
  }
};

verifyOtpBtn.onclick = async () => {
  if(!authSessionId){authMsg('First click Send OTP.');return;}
  const code=authOtp.value.trim();
  if(!/^\d{6}$/.test(code)){authMsg('Enter the 6-digit OTP.');return;}
  verifyOtpBtn.disabled=true;
  const r=await window.studioAPI.authVerifyOtp(authSessionId,code);
  verifyOtpBtn.disabled=false;
  if(r.ok){
    sessionStorage.setItem('was-auth-session','verified');
    authOverlay.classList.add('hidden');
    document.getElementById('status').textContent='Ready';
  } else authMsg(r.error);
};
