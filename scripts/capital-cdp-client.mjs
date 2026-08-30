export async function connectCapitalAudit(port=9356) {
  const tabs=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  const tab=tabs.find(t=>t.type==='page' && (t.url==='about:blank' || t.url.startsWith('http://127.0.0.1:3130/')));
  if(!tab) throw new Error('Launch an isolated Edge profile on the audit port first.');
  const ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail});
  let id=0; const pending=new Map();
  ws.onmessage=({data})=>{const m=JSON.parse(String(data));if(pending.has(m.id)){
    const [ok,fail,timer]=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);
    m.error?fail(new Error(JSON.stringify(m.error))):ok(m.result);
  }};
  const send=(method,params={})=>new Promise((ok,fail)=>{
    const n=++id;const timer=setTimeout(()=>{pending.delete(n);fail(new Error(`CDP timeout ${method}`))},45000);
    pending.set(n,[ok,fail,timer]);ws.send(JSON.stringify({id:n,method,params}));
  });
  const evaluate=async expression=>{
    const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  return {send,evaluate,close:()=>ws.close()};
}
