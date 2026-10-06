import {useEffect,useState,type ReactNode} from 'react';
export function SessionGate({children}:{children:ReactNode}){
  const [status,setStatus]=useState<'loading'|'login'|'ready'|'error'>('loading'),[required,setRequired]=useState(false),[token,setToken]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(false);
  const check=async()=>{setStatus('loading');try{const response=await fetch('/api/session');if(!response.ok)throw new Error();
    const data=await response.json() as {required:boolean;authenticated:boolean};setRequired(data.required);setStatus(data.authenticated?'ready':'login');
  }catch{setStatus('error');}};
  useEffect(()=>{void check();const denied=()=>{setToken('');setStatus('login');};window.addEventListener('fbr-auth-required',denied);return()=>window.removeEventListener('fbr-auth-required',denied);},[]);
  if(status==='loading')return <main><p role="status">Conectando à instalação...</p></main>;
  if(status==='error')return <main><p role="alert">Não foi possível conectar à API.</p><button onClick={()=>void check()}>Tentar novamente</button></main>;
  if(status==='ready')return <>{required&&<button type="button" onClick={()=>{void fetch('/api/session/logout',{method:'POST'}).then(()=>{setToken('');setStatus('login');});}}>Encerrar sessão</button>}{children}</>;
  return <main><h1>Acessar FBR Videos</h1><form className="connected-form" onSubmit={event=>{event.preventDefault();if(pending)return;setPending(true);setError('');
    void fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}).then(response=>{if(!response.ok)throw new Error();setToken('');setStatus('ready');setRequired(true);})
      .catch(()=>setError('Acesso não autorizado. Confira a chave ou aguarde antes de tentar novamente.')).finally(()=>setPending(false));
  }}><label>Chave de acesso<input type="password" autoComplete="current-password" value={token} maxLength={1024} disabled={pending} onChange={event=>setToken(event.target.value)}/></label>
    <button type="submit" disabled={pending||!token}>Entrar</button>{error&&<p role="alert">{error}</p>}</form></main>;
}
