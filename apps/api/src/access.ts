import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
const digest=(value:string)=>createHash('sha256').update(value).digest();
/** Principal único provisionável para instalação privada; sessões não contêm a chave do operador. */
export class OperatorAccess{
  private readonly sessions=new Map<string,number>();
  private readonly attempts=new Map<string,{count:number;until:number}>();
  private readonly secret:Buffer;
  constructor(token:string,readonly secureCookie:boolean){if(token.length<32)throw new Error('operator_token_too_short');this.secret=digest(token);}
  authenticated(authorization:string|undefined,cookie:string|undefined){
    if(authorization?.startsWith('Bearer ')&&timingSafeEqual(digest(authorization.slice(7)),this.secret))return true;
    const value=cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('fbr_session='))?.slice(12);
    if(!value)return false;const key=digest(value).toString('hex'),expires=this.sessions.get(key);
    if(!expires||expires<=Date.now()){this.sessions.delete(key);return false;}return true;
  }
  login(token:string,ip:string){
    const now=Date.now();for(const [key,expiry]of this.sessions)if(expiry<=now)this.sessions.delete(key);
    for(const [key,value]of this.attempts)if(value.until<=now)this.attempts.delete(key);
    const entry=this.attempts.get(ip)??{count:0,until:now+60000};entry.count++;
    if(this.attempts.size<200||this.attempts.has(ip))this.attempts.set(ip,entry);else return null;
    if(entry.count>5||!timingSafeEqual(digest(token),this.secret)||this.sessions.size>=100)return null;
    const session=randomBytes(32).toString('hex');this.sessions.set(digest(session).toString('hex'),now+8*3600000);
    return `fbr_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${this.secureCookie?'; Secure':''}`;
  }
  logout(cookie:string|undefined){
    const value=cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('fbr_session='))?.slice(12);
    if(value)this.sessions.delete(digest(value).toString('hex'));
    return `fbr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${this.secureCookie?'; Secure':''}`;
  }
}
