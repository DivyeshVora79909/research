import fs from 'node:fs';
import {sql,rpc,request,config} from './client.mjs';
const db='security';const results=[];
const root=async q=>sql(q,{db});
function add(name,response,pass){results.push({name,pass:!!pass,response});}
const setup=`
DEFINE TABLE person SCHEMALESS PERMISSIONS FULL;
CREATE person:alice SET name='alice'; CREATE person:bob SET name='bob';
DEFINE ACCESS fixture ON DATABASE TYPE RECORD SIGNIN (SELECT * FROM person WHERE name=$name);
DEFINE TABLE secret SCHEMALESS PERMISSIONS NONE;
CREATE secret:alice SET owner=person:alice, text='alice secret';
CREATE secret:bob SET owner=person:bob, text='bob secret';
DEFINE FUNCTION fn::read_secret() { RETURN SELECT * FROM secret; } PERMISSIONS WHERE $auth != NONE;
DEFINE FUNCTION fn::helper($id: record<secret>) { RETURN SELECT * FROM $id WHERE owner=$auth.id; } PERMISSIONS NONE;
DEFINE API '/notes/:id' FOR get PERMISSIONS WHERE $auth != NONE THEN { RETURN {status:200, body: encoding::json::encode(fn::helper(type::record('secret',$request.params.id))), context: {}}; };
DEFINE FUNCTION fn::explode() { CREATE rollback:fn_one; CREATE rollback:fn_two; THROW 'expected rollback'; } PERMISSIONS FULL;
DEFINE API '/explode' FOR post PERMISSIONS WHERE $auth != NONE THEN { CREATE rollback:api_one; CREATE rollback:api_two; THROW 'expected rollback'; };
DEFINE TABLE rollback SCHEMALESS PERMISSIONS FULL;
`;
await root('REMOVE DATABASE security;'); await root('DEFINE DATABASE security;'); let r=await root(setup);add('fixture_setup',r,r.value?.every(x=>x.status==='OK'));
async function login(name){const r=await rpc('signin',[{ns:config.ns,db,ac:'fixture',name}],{db,anonymous:true});if(!r.value?.result)throw new Error('signin failed '+JSON.stringify(r));return r.value.result;}
const alice=await login('alice'),bob=await login('bob');
const query=async(q,token)=>sql(q,{db,token,anonymous:!token});
for(const [name,token] of [['alice',alice],['bob',bob],['anonymous',null]]){
 r=await query('SELECT * FROM secret;',token); add(name+'_direct_select',r,r.status===403||r.value?.[0]?.status==='OK'&&r.value[0].result.length===0);
 r=await query("CREATE secret:intruder SET text='bad';",token);add(name+'_direct_create_denied',r,r.status===403||r.value?.[0]?.status==='ERR'||r.value?.[0]?.result?.length===0);
 r=await query('fn::read_secret();',token);add(name+'_udf_reads_none',r,name==='anonymous'?r.status===403||r.value?.[0]?.status==='ERR':r.status===403||r.value?.[0]?.status==='OK'&&r.value[0].result.length===0);
 r=await query('fn::helper(secret:alice);',token);add(name+'_helper_direct_denied',r,r.status===403||r.value?.[0]?.status==='ERR');
}
for(const [name,token] of [['alice',alice],['bob',bob],['anonymous',null]])for(const id of ['alice','bob']){
 r=await query(`api::invoke('/notes/${id}');`,token);const out=r.value?.[0]?.result;add(name+'_api_invoke_'+id,r,name==='anonymous'?r.status===403||out?.status===403:out?.status===200&&JSON.parse(out.body).length===(name===id?1:0));
 r=await request(`/api/${config.ns}/${db}/notes/${id}`,undefined,{db,token,anonymous:!token,method:'GET'});add(name+'_http_api_'+id,r,name==='anonymous'?r.status===403:r.status===200&&Array.isArray(r.value)&&r.value.length===(name===id?1:0));
}
r=await query('fn::explode();',alice);add('function_throw',r,r.status===403||r.value?.[0]?.status==='ERR');
r=await root('SELECT * FROM rollback;');add('function_throw_rollback',r,r.value?.[0]?.result?.length===0);
r=await query("api::invoke('/explode',{method:'post'});",alice);add('api_throw',r,r.value?.[0]?.status==='ERR'||r.value?.[0]?.result?.status>=400);
r=await root('SELECT * FROM rollback;');add('api_throw_rollback',r,r.value?.[0]?.result?.length===0);
r=await root('DELETE rollback;');
r=await request(`/api/${config.ns}/${db}/explode`,undefined,{db,token:alice,method:'POST'});add('http_api_throw',r,r.status===500);
r=await root('SELECT * FROM rollback;');add('http_api_throw_rollback',r,r.value?.[0]?.result?.length===0);
r=await root('DELETE rollback;');
r=await root("BEGIN; RETURN api::invoke('/explode',{method:'post'}); CANCEL;");add('explicit_transaction_cancel_api',r,true);
r=await root('SELECT * FROM rollback;');add('explicit_cancel_removes_api_writes',r,r.value?.[0]?.result?.length===0);
r=await root('fn::explode();');add('root_function_throw',r,r.value?.[0]?.status==='ERR');
r=await root('SELECT * FROM rollback;');add('root_function_throw_rollback',r,r.value?.[0]?.result?.length===0);
r=await root("DEFINE API '/function-explode' FOR post PERMISSIONS WHERE $auth != NONE THEN { fn::explode(); };");add('define_api_function_throw',r,r.value?.[0]?.status==='OK');
r=await request(`/api/${config.ns}/${db}/function-explode`,undefined,{db,token:alice,method:'POST'});add('http_api_function_throw',r,r.status===500);
r=await root('SELECT * FROM rollback;');add('http_api_function_throw_rollback',r,r.value?.[0]?.result?.length===0);
r=await root('SELECT * FROM secret;');add('direct_denied_writes_absent',r,r.value?.[0]?.result?.length===2);
const output={version:'3.3.5',db,setup,results,passed:results.filter(x=>x.pass).length,total:results.length};fs.writeFileSync('/tmp/rebase-surreal-study/security-results.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output));
