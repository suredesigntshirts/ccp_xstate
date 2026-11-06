const { chromium } = require('playwright'); const fs=require('fs'),path=require('path');
(async () => { const out = process.argv[2];
  const txt = fs.readFileSync(path.join(out,'data.js'),'utf8'); const D = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}')+1));
  const b = await chromium.launch(); const page = await b.newPage(); const errs=[]; page.on('console', m=>m.type()==='error'&&errs.push(m.text())); page.on('pageerror', e=>errs.push(String(e)));
  await page.goto('file://'+path.resolve(out,'index.html'));
  const res = []; const bad=[];
  for (const r of D.runs) for (let i=0;i<r.steps.length;i++) { const st=r.steps[i]; if(!(st.actors||[]).some(a=>a.stage)) continue;
    await page.evaluate(([id,i])=>{location.hash=`run=${id}&step=${i}`; dispatchEvent(new PopStateEvent('popstate'));},[r.id,i]);
    await page.waitForTimeout(200);
    const lines = await page.$$eval('.piece .srcline', els=>els.map(e=>e.textContent));
    const expected = r.steps.flatMap(s=>s.actors||[]).filter(a=>a.stage).flatMap(a=>a.stage.parts.flatMap(p=>p.pieces.map(x=>x.source)));
    res.push({step:i, shown:lines.length, expected:expected.length});
    expected.forEach((s,k)=>{ const l=lines[k]||''; if(s.entry && !l.includes(`message catalogue entry ${s.entry} (packages/engine/messages.md)`)) bad.push([i,k,l]); if(/stages\.js/.test(l)) bad.push(['stagesjs',i,k,l]); });
    
  }
  console.log(JSON.stringify({res,bad,errs})); await b.close(); })();
