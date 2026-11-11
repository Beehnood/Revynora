import json,subprocess,time,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
report={'source':'f04e00884761c17ba8b4f7e104e406f546f4e667','previous_image':'BLOCKED: exact deployed image archive not available on hosted runner'}
def run(args,**kwargs):
 r=subprocess.run(args,capture_output=True,text=True,**kwargs)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+' '+args[1]+' (details suppressed)')
 return r.stdout.strip()
def docker(*a):return run(['docker',*a])
try:
 for name in ['pdf-runtime','pdf-migrate']:
  m=json.loads(docker('image','inspect',name))[0]
  assert m['Architecture']=='arm64' and m['Config']['User']=='node'
  report[name]={'imageId':m['Id'],'architecture':m['Architecture']}
 docker('network','create','--internal','pdf-test')
 docker('run','-d','--name','pdf-pg','--network','pdf-test','--memory','512m','--cpus','1','-e','POSTGRES_USER=pdf_test','-e','POSTGRES_PASSWORD=isolated_ci_only','-e','POSTGRES_DB=revynora_test','postgres:17.6-alpine')
 for i in range(60):
  if subprocess.run(['docker','exec','pdf-pg','pg_isready','-U','pdf_test','-d','revynora_test'],capture_output=True).returncode==0:break
  time.sleep(1)
 url='postgresql://pdf_test:isolated_ci_only@pdf-pg:5432/revynora_test'
 docker('run','--name','pdf-migration','--network','pdf-test','-e','DATABASE_URL='+url,'--entrypoint','pnpm','pdf-migrate','db:migrate')
 sql='SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'
 assert docker('exec','pdf-pg','psql','-U','pdf_test','-d','revynora_test','-Atc',sql)=='13'
 report['migrations']='PASS: 13 completed'
 # Catalogue only in synthetic DB; no grants/accounts in Production.
 docker('run','--network','pdf-test','-e','DATABASE_URL='+url,'--entrypoint','pnpm','pdf-migrate','db:catalog')
 mount=str(ROOT/'extract.cjs')+':/tmp/extract.cjs:ro'
 out=docker('run','--name','pdf-extractor','--network','none','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--memory','768m','--cpus','1','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges','-v',mount,'--entrypoint','node','pdf-runtime','/tmp/extract.cjs')
 report['extraction']=json.loads(out.splitlines()[-1])
 env=['DATABASE_URL='+url,'AI_PROVIDER=mock','WORKER_ENABLED=false','BILLING_PROVIDER=mock','MAIL_PROVIDER=local','COOKIE_SECURE=true','WEB_ORIGIN=https://example.test','ADMIN_ORIGIN=https://admin.example.test','GEMINI_API_KEY=','OPENAI_API_KEY=']
 args=['run','-d','--name','pdf-api','--network','pdf-test','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--memory','768m','--cpus','1','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges']
 for value in env:args+=['-e',value]
 docker(*args,'pdf-runtime')
 ready=False
 for i in range(60):
  r=subprocess.run(['docker','exec','pdf-api','node','-e',"fetch('http://127.0.0.1:3001/api/v1/health/ready').then(async r=>process.exit(r.ok&&(await r.json()).status==='ready'?0:1)).catch(()=>process.exit(1))"],capture_output=True)
  if r.returncode==0:ready=True;break
  time.sleep(2)
 assert ready,'NestJS not ready'
 report['nestjs']='PASS';report['resources']=docker('stats','--no-stream','--format','{{.MemUsage}} | {{.CPUPerc}}','pdf-api')
 # Live Prisma query with runtime engine, not just module import.
 docker('exec','pdf-api','node','-e',"const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.pdfDocument.count().then(n=>{if(n!==0)throw Error();}).finally(()=>p.$disconnect());")
 report['prismaRuntime']='PASS'
except Exception as e:
 report['failure']=str(e)
 raise
finally:
 pathlib.Path('evidence.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report))
