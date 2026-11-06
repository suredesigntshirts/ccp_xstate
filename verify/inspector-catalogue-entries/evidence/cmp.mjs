import fs from 'node:fs'; import path from 'node:path';
const [out, cap] = process.argv.slice(2);
const txt = fs.readFileSync(path.join(out,'data.js'),'utf8'); const D = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}')+1));
const files = []; const walk = (d) => { for (const f of fs.readdirSync(d,{withFileTypes:true})) { const p = path.join(d,f.name); f.isDirectory()?walk(p):f.name==='stage.json'&&files.push(p);} }; walk(cap);
const html = fs.readFileSync(path.join(out,'index.html'),'utf8');
let n=0, bad=[], frames=0, entries=new Set();
for (const run of D.runs) for (const st of run.steps) for (const a of st.actors||[]) { if(!a.stage) continue;
  const runName = a.effect.split(':').pop();
  const f = files.find(p => p.includes(`/runs/${runName}/`)); if(!f){bad.push('no stage.json for '+a.effect);continue;}
  const rec = JSON.parse(fs.readFileSync(f,'utf8'));
  for (const part of a.stage.parts) { const recPieces = rec.prompt.parts[part.part]; if(!recPieces){bad.push('missing part '+part.part);continue;}
    if (recPieces.length!==part.pieces.length) bad.push(`count ${a.effect} ${part.part}`);
    part.pieces.forEach((p,i)=>{ n++; const e = recPieces[i]?.source?.entry; if (p.source.entry!==e) bad.push(`${a.effect} ${part.part}[${i}] bundle ${p.source.entry} rec ${e}`);
      if (e) entries.add(e);
      if (p.source.kind==='frame'){frames++; if(!p.source.detail.includes(`message catalogue entry ${e} `)||/stages\.js/.test(p.source.detail)) bad.push('frame detail '+p.source.detail);} }); } }
console.log(JSON.stringify({pieces:n, frames, entries:[...entries], bad}, null, 1));
