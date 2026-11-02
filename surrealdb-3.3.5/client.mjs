import fs from 'node:fs';
export const config=JSON.parse(fs.readFileSync('/tmp/rebase-surreal-study/connection.json','utf8'));
export async function request(path,body,{db=config.db,token,anonymous=false,method='POST',json=false}={}){
 const headers={Accept:'application/json','surreal-ns':config.ns,'surreal-db':db};
 if(!anonymous)headers.Authorization=token?`Bearer ${token}`:`Basic ${Buffer.from(`${config.user}:${config.pass}`).toString('base64')}`;
 if(json)headers['Content-Type']='application/json';else headers['Content-Type']='text/plain';
 const response=await fetch(config.base+path,{method,headers,body:body===undefined?undefined:json?JSON.stringify(body):body});const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}return{status:response.status,value};
}
export async function sql(query,opts={}){return await request('/sql',query,opts);}
export async function rpc(method,params,opts={}){return await request('/rpc',{id:1,method,params},{...opts,json:true});}
