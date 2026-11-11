const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PdfExtractor } = require('/app/apps/api/dist/documents/pdf-extractor.js');
function pdf() {
  const objects = [];
  const add = s => objects.push(s);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let i=0;i<2;i++) {
    const text = i ? 'La photosynthese utilise de l eau et du dioxyde de carbone.' : 'La membrane controle les echanges de la cellule avec son environnement.';
    const stream = `BT /F1 12 Tf 30 700 Td (${text}) Tj ET`;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
    add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let s='%PDF-1.7\n'; const offsets=[0];
  objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const x=Buffer.byteLength(s);
  s+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('');
  return Buffer.from(s+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`);
}
(async()=>{
  assert.equal(process.arch,'arm64');
  require('/app/apps/api/node_modules/@prisma/client');
  const extractor=new PdfExtractor(); const data=pdf();
  const check=pages=>{assert.equal(pages.length,2);assert.match(pages[0].text,/membrane/);assert.match(pages[1].text,/photosynthese/);};
  check(await extractor.extract(data));
  await new Promise(r=>setTimeout(r,300));
  const threads=()=>fs.readdirSync('/proc/self/task').length;
  const warm=threads();
  for(let i=0;i<3;i++)(await Promise.all([extractor.extract(data),extractor.extract(data)])).forEach(check);
  await assert.rejects(extractor.extract(Buffer.from('invalid')),e=>e.code==='PDF_INVALID');
  await new Promise(r=>setTimeout(r,500));
  assert.ok(threads()<=warm+1,'Worker threads leaked');
  fs.writeFileSync('/tmp/synthetic.pdf',data);
  console.log(JSON.stringify({pdf:'PASS',pages:2,concurrent:2,workerShutdown:'PASS',threads:threads(),peakBytes:fs.readFileSync('/sys/fs/cgroup/memory.peak','utf8').trim()}));
})().catch(e=>{console.error('ARM64 PDF validation failed: '+e.name+': '+e.message);process.exitCode=1;});
