import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set, remove, push } from 'firebase/database'
import { db } from './firebase.js'

const PAR   = 3
const HOLES = 18
const PLAYER_COLORS = ['#F2578A','#C93469','#FF6B35','#9B59B6','#2196F3','#16a34a','#E91E63','#FF9800','#00BCD4','#8BC34A']
const GROUP_COLORS  = ['#F2578A','#9B59B6','#2196F3','#16a34a','#FF9800','#00BCD4','#FF6B35','#8BC34A']
const GROUP_NAMES   = ['Group 1','Group 2','Group 3','Group 4','Group 5','Group 6','Group 7','Group 8']

const BONUS_LIST = [
  { id:'holeinone',   label:'Hole in One',      icon:'🕳️', pts:5  },
  { id:'eagle',       label:'Eagle Shot',        icon:'🦅', pts:4  },
  { id:'closestpin',  label:'Closest to Pin',    icon:'📍', pts:3  },
  { id:'epicshot',    label:'Epic Comeback',     icon:'🔥', pts:3  },
  { id:'bestdressed', label:'Best Dressed',      icon:'👗', pts:2  },
  { id:'vibe',        label:'Best Energy',       icon:'🎉', pts:2  },
  { id:'lucky',       label:'Lucky Bounce',      icon:'🍀', pts:2  },
  { id:'birthday',    label:'Birthday Girl 🎂',  icon:'🎀', pts:10 },
]

// ── helpers ───────────────────────────────────────────────────────────────────
function getScore(scores, pid, c, h) { return scores?.[pid]?.[c]?.[h] ?? 0 }
function courseTotal(scores, pid, c) { let t=0; for(let h=0;h<HOLES;h++) t+=getScore(scores,pid,c,h); return t }
function playerTotals(scores, bonuses, pid) {
  const strokes  = courseTotal(scores,pid,0) + courseTotal(scores,pid,1)
  const bonusPts = Object.keys(bonuses?.[pid]??{}).filter(k=>bonuses[pid][k])
    .reduce((s,k)=>{ const b=BONUS_LIST.find(x=>x.id===k); return s+(b?b.pts:0) },0)
  return { strokes, bonusPts, net: strokes-bonusPts }
}
function diffLabel(s) {
  if(!s) return null
  const d=s-PAR
  if(s===1)  return {label:'ACE! 🕳️', cls:'diff-ace'}
  if(d<=-2)  return {label:'Eagle 🦅', cls:'diff-eagle'}
  if(d===-1) return {label:'Birdie 🐦',cls:'diff-birdie'}
  if(d===0)  return {label:'Par ✓',    cls:'diff-par'}
  if(d===1)  return {label:'+1 Bogey', cls:'diff-bogey'}
  return           {label:`+${d}`,     cls:'diff-dbl'}
}
function resizeImage(file) {
  return new Promise(res=>{
    const img=new Image(),url=URL.createObjectURL(file)
    img.onload=()=>{
      let w=img.width,h=img.height,MAX=600
      if(w>MAX||h>MAX){ if(w>h){h=Math.round(h*MAX/w);w=MAX}else{w=Math.round(w*MAX/h);h=MAX} }
      const c=document.createElement('canvas');c.width=w;c.height=h
      c.getContext('2d').drawImage(img,0,0,w,h)
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.65))
    }; img.src=url
  })
}

// ── confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({length:60},(_,i)=>({
    id:i, color:['#F2578A','#F5C842','#FF6B35','#9B59B6','#2196F3','#16a34a','#fff'][i%7],
    left:`${Math.random()*100}%`, delay:`${Math.random()*3}s`,
    duration:`${2.5+Math.random()*2}s`, size:`${6+Math.random()*8}px`,
    shape: i%3===0 ? 'circle' : 'rect'
  }))
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:999,overflow:'hidden'}}>
      {pieces.map(p=>(
        <div key={p.id} style={{
          position:'absolute', top:'-20px', left:p.left,
          width:p.size, height:p.shape==='circle'?p.size:`${parseInt(p.size)*0.6}px`,
          borderRadius:p.shape==='circle'?'50%':'2px',
          background:p.color, opacity:0.9,
          animation:`confettiFall ${p.duration} ${p.delay} ease-in forwards`
        }}/>
      ))}
    </div>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
  :root {
    --pink:#F2578A; --pink-light:#FDE8F0; --pink-mid:#F8B8D0; --pink-deep:#C93469;
    --cream:#FFF7F9; --text:#3D1A26; --muted:#9A6676;
    --flame:#FF6B35; --ember:#FF9A3C; --gold:#F5C842;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-tap-highlight-color:transparent}
  body{font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--text);overscroll-behavior:none}

  .hdr{background:linear-gradient(135deg,#F2578A 0%,#C93469 50%,#a0254e 100%);position:relative;overflow:hidden}
  .hdr::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 15% 30%,rgba(255,255,255,.18) 2px,transparent 2px),radial-gradient(circle at 75% 20%,rgba(255,255,255,.12) 3px,transparent 3px),radial-gradient(circle at 30% 80%,rgba(245,200,66,.2) 3px,transparent 3px);pointer-events:none}
  .hdr-inner{position:relative;padding:22px 20px 0}
  .hdr-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);border-radius:20px;padding:4px 12px;font-size:.7rem;font-weight:700;color:#fff;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}
  .hdr-title{font-family:'Playfair Display',serif;font-weight:900;font-size:2.1rem;color:#fff;line-height:1.05}
  .hdr-title em{font-style:italic;color:var(--gold)}
  .hdr-sub{color:rgba(255,255,255,.7);font-size:.72rem;font-weight:500;margin-top:5px;letter-spacing:2px;text-transform:uppercase}
  .hdr-pills{display:flex;gap:6px;margin-top:14px;padding-bottom:16px;flex-wrap:wrap}
  .hdr-pill{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:5px 12px;font-size:.72rem;font-weight:600;color:#fff}
  .hdr-reset{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:5px 10px;color:rgba(255,255,255,.6);font-size:.65rem;cursor:pointer;font-family:'DM Sans',sans-serif}
  .hdr-reset:hover{color:#fff;background:rgba(255,255,255,.25)}
  .live-dot{display:inline-block;width:8px;height:8px;background:#4ade80;border-radius:50%;margin-right:4px;animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
  @keyframes popIn{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
  @keyframes slideUp{0%{transform:translateY(30px);opacity:0}100%{transform:translateY(0);opacity:1}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}

  .tabs{display:flex;overflow-x:auto;background:var(--pink-deep);scrollbar-width:none;padding:0 6px 6px}
  .tabs::-webkit-scrollbar{display:none}
  .tab{flex:0 0 auto;min-width:68px;padding:9px 10px;border:none;background:rgba(255,255,255,.1);color:rgba(255,255,255,.65);font-family:'DM Sans',sans-serif;font-size:.67rem;font-weight:700;cursor:pointer;border-radius:8px 8px 0 0;transition:all .18s;white-space:nowrap;text-transform:uppercase;letter-spacing:.5px;text-align:center}
  .tab.active{background:var(--cream);color:var(--pink-deep)}
  .tab:hover:not(.active){background:rgba(255,255,255,.2);color:#fff}

  .page{padding:16px;max-width:560px;margin:0 auto;padding-bottom:90px}
  .card{background:#fff;border-radius:20px;padding:18px;box-shadow:0 2px 16px rgba(242,87,138,.08),0 1px 4px rgba(0,0,0,.04);margin-bottom:14px;border:1px solid rgba(242,87,138,.1)}
  .card-title{font-family:'Playfair Display',serif;font-weight:700;color:var(--pink-deep);font-size:1.05rem;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .sec-lbl{font-size:.68rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}

  .row{display:flex;gap:8px;margin-bottom:10px}
  .inp{flex:1;padding:11px 14px;border:2px solid var(--pink-light);border-radius:12px;font-family:'DM Sans',sans-serif;font-size:.9rem;outline:none;color:var(--text);background:var(--cream);transition:border-color .2s}
  .inp:focus{border-color:var(--pink)}
  .inp::placeholder{color:var(--muted)}
  .select-inp{width:100%;padding:10px 14px;border:2px solid var(--pink-light);border-radius:12px;font-family:'DM Sans',sans-serif;font-size:.88rem;outline:none;color:var(--text);background:#fff;margin-bottom:12px;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23F2578A' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
  .select-sm{padding:5px 28px 5px 10px;border:1.5px solid var(--pink-mid);border-radius:8px;font-family:'DM Sans',sans-serif;font-size:.75rem;outline:none;color:var(--text);background:#fff;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23F2578A' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;cursor:pointer}

  .btn{padding:11px 18px;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:.88rem;font-weight:700;cursor:pointer;transition:all .15s}
  .btn-pink{background:var(--pink);color:#fff}
  .btn-pink:hover{background:var(--pink-deep);transform:translateY(-1px);box-shadow:0 4px 12px rgba(242,87,138,.35)}
  .btn-danger{background:#fff0f3;color:#c0392b;font-size:.75rem;padding:6px 10px;border-radius:8px}
  .btn-danger:hover{background:#ffd5d5}

  .player-chip{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;margin-bottom:8px;background:linear-gradient(135deg,#fff,var(--pink-light));border:1px solid var(--pink-mid)}
  .avatar{border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:#fff;flex-shrink:0}
  .av-lg{width:38px;height:38px;font-size:1rem}
  .av-sm{width:30px;height:30px;font-size:.85rem}
  .av-xs{width:22px;height:22px;font-size:.6rem}
  .chip-name{flex:1;font-weight:700;color:var(--text);font-size:.9rem}
  .pill{border-radius:20px;padding:3px 10px;font-size:.72rem;font-weight:700;display:inline-flex;align-items:center;gap:4px}
  .pill-pink{background:var(--pink-light);color:var(--pink-deep)}
  .pill-gold{background:#FFF8D6;color:#B8860B}
  .pill-flame{background:#FFF0E6;color:var(--flame)}

  .psel{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
  .psel-btn{padding:6px 14px;border-radius:20px;border:2px solid var(--pink-mid);background:#fff;font-family:'DM Sans',sans-serif;font-weight:600;font-size:.8rem;cursor:pointer;transition:all .2s;color:var(--muted)}
  .psel-btn.active{color:#fff;border-color:transparent}
  .gsel{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}
  .gsel-btn{padding:5px 12px;border-radius:20px;border:2px solid #eee;background:#fff;font-family:'DM Sans',sans-serif;font-weight:600;font-size:.75rem;cursor:pointer;transition:all .2s;color:var(--muted)}
  .gsel-btn.active{color:#fff;border-color:transparent}

  .holes-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .hole-card{border-radius:14px;padding:10px 8px;text-align:center;border:2px solid #f5e6eb;background:#fffafc;transition:border-color .2s}
  .hole-card.scored{border-color:var(--pink-mid);background:var(--pink-light)}
  .hole-lbl{font-size:.6rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
  .hole-par{font-size:.58rem;color:#c0a0a8;margin-bottom:6px}
  .sc-row{display:flex;align-items:center;justify-content:center;gap:5px}
  .sc-btn{width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;font-size:1.1rem;font-weight:900;display:flex;align-items:center;justify-content:center;transition:transform .12s;user-select:none}
  .sc-btn:active{transform:scale(.9)}
  .sc-minus{background:#ffe0ea;color:var(--pink-deep)}
  .sc-plus{background:var(--pink-light);color:var(--pink-deep)}
  .sc-val{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:700;min-width:26px;color:var(--pink-deep)}
  .sc-diff{font-size:.6rem;font-weight:800;margin-top:4px}
  .diff-ace{color:#7c3aed}.diff-eagle{color:#1d4ed8}.diff-birdie{color:#16a34a}.diff-par{color:#6b7280}.diff-bogey{color:var(--flame)}.diff-dbl{color:#dc2626}

  /* scorecard */
  .scorecard-wrap{overflow-x:auto;margin:0 -18px;padding:0 18px}
  .scorecard-table{border-collapse:collapse;font-size:.72rem;min-width:100%}
  .scorecard-table th{background:var(--pink-deep);color:#fff;padding:6px 8px;font-weight:700;white-space:nowrap;position:sticky;top:0}
  .scorecard-table th.sticky-col{position:sticky;left:0;z-index:2;background:var(--pink-deep)}
  .scorecard-table td{padding:5px 7px;border-bottom:1px solid var(--pink-light);white-space:nowrap;text-align:center}
  .scorecard-table td.sticky-col{position:sticky;left:0;background:#fff;z-index:1;font-weight:700;text-align:left;border-right:2px solid var(--pink-light)}
  .scorecard-table tr:nth-child(even) td{background:#fff9fb}
  .scorecard-table tr:nth-child(even) td.sticky-col{background:#fff9fb}
  .sc-cell-ace{background:#ede9fe!important;color:#7c3aed;font-weight:800}
  .sc-cell-eagle{background:#dbeafe!important;color:#1d4ed8;font-weight:800}
  .sc-cell-birdie{background:#dcfce7!important;color:#16a34a;font-weight:700}
  .sc-cell-bogey{background:#fff7ed!important;color:var(--flame)}
  .sc-cell-dbl{background:#fee2e2!important;color:#dc2626}
  .sc-cell-total{font-family:'Playfair Display',serif;font-weight:700;color:var(--pink-deep);background:var(--pink-light)!important}
  .sc-cell-net{font-family:'Playfair Display',serif;font-weight:800;color:#fff;background:var(--pink-deep)!important}

  /* bonus */
  .bonus-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .bonus-card{border:2px solid #f0e0e6;border-radius:14px;padding:12px 10px;text-align:center;cursor:pointer;transition:all .2s;background:#fffafc}
  .bonus-card.on{background:linear-gradient(135deg,#FFF8D6,#FFFBE8);border-color:var(--gold)}
  .bonus-card:hover{border-color:var(--pink);transform:translateY(-1px)}
  .bonus-icon{font-size:1.6rem;margin-bottom:4px}
  .bonus-lbl{font-size:.73rem;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:3px}
  .bonus-pts{font-family:'Playfair Display',serif;font-size:.85rem;color:var(--flame);font-weight:700}

  /* braai vote */
  .vote-card{border:2px solid #ffe0c4;border-radius:16px;padding:14px;background:linear-gradient(135deg,#FFF5EE,#FFF8F0);margin-bottom:10px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px}
  .vote-card:hover{border-color:var(--flame);transform:translateY(-1px)}
  .vote-card.my-vote{border-color:var(--flame);background:linear-gradient(135deg,#FFF0E6,#FFE8D4);box-shadow:0 2px 12px rgba(255,107,53,.2)}
  .vote-bar{height:4px;background:#ffe0c4;border-radius:2px;margin-top:8px}
  .vote-bar-fill{height:100%;background:linear-gradient(90deg,var(--ember),var(--flame));border-radius:2px;transition:width .4s}

  /* photos */
  .upload-zone{border:2px dashed var(--pink-mid);border-radius:16px;padding:24px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:14px;background:var(--pink-light)}
  .upload-zone:hover{border-color:var(--pink);background:#fce4ee}
  .photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .photo-thumb{border-radius:14px;overflow:hidden;aspect-ratio:1;position:relative;cursor:pointer;box-shadow:0 2px 8px rgba(242,87,138,.15);border:2px solid var(--pink-light)}
  .photo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .photo-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(201,52,105,.75) 0%,transparent 55%);opacity:0;transition:opacity .2s;display:flex;align-items:flex-end;padding:8px;gap:6px}
  .photo-thumb:hover .photo-overlay{opacity:1}
  .photo-del-btn{background:rgba(255,255,255,.9);border:none;border-radius:6px;padding:3px 8px;font-size:.7rem;font-weight:700;color:#c0392b;cursor:pointer}
  .lightbox{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
  .lightbox img{max-width:100%;max-height:90vh;border-radius:14px;object-fit:contain}
  .lightbox-close{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.4rem;cursor:pointer;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center}

  /* leaderboard */
  .podium-wrap{display:flex;align-items:flex-end;justify-content:center;gap:6px;margin-bottom:20px;height:130px}
  .pod-col{display:flex;flex-direction:column;align-items:center;flex:1;max-width:120px}
  .pod-name{font-weight:700;font-size:.72rem;text-align:center;color:var(--text);margin-bottom:4px;word-break:break-word;max-width:90px}
  .pod-blk{width:100%;border-radius:10px 10px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:8px}
  .pod-1{height:95px;background:linear-gradient(135deg,var(--gold),var(--ember))}
  .pod-2{height:72px;background:linear-gradient(135deg,#c0c0c0,#888)}
  .pod-3{height:55px;background:linear-gradient(135deg,#cd7f32,#8d5524)}
  .pod-score{font-family:'Playfair Display',serif;color:#fff;font-size:1.05rem;font-weight:700}
  .pod-medal{font-size:1.2rem;margin-bottom:2px}
  .lb-row{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:14px;margin-bottom:7px;background:#fff;border:1.5px solid var(--pink-light)}
  .lb-row.top{background:linear-gradient(135deg,#FFF5F8,#FDE8F0);border-color:var(--pink-mid)}
  .lb-rank{font-family:'Playfair Display',serif;font-size:1rem;color:var(--muted);min-width:26px;text-align:center}
  .lb-name{flex:1;font-weight:700;color:var(--text)}
  .lb-right{text-align:right}
  .lb-net{font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--pink-deep)}
  .lb-tiny{font-size:.65rem;color:var(--muted)}
  .lb-bonus-tag{background:#FFF8D6;color:#B8860B;border-radius:6px;padding:2px 6px;font-size:.68rem;font-weight:700}

  /* winner screen */
  .winner-screen{min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;position:relative}
  .winner-crown{font-size:5rem;animation:popIn .6s ease forwards}
  .winner-title{font-family:'Playfair Display',serif;font-size:1rem;color:var(--muted);font-weight:700;margin:12px 0 4px;text-transform:uppercase;letter-spacing:2px}
  .winner-name{font-family:'Playfair Display',serif;font-size:2.8rem;font-weight:900;line-height:1.1;background:linear-gradient(135deg,var(--pink),var(--gold),var(--flame));-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:slideUp .5s .3s ease both}
  .winner-score{font-family:'Playfair Display',serif;font-size:1.1rem;color:var(--muted);margin-top:6px;animation:slideUp .5s .5s ease both}
  .winner-divider{width:60px;height:3px;background:linear-gradient(90deg,var(--pink),var(--gold));border-radius:2px;margin:20px auto}
  .winner-podium{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:16px 0;width:100%}
  .winner-shimmer{background:linear-gradient(90deg,var(--pink),var(--gold),var(--pink));background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 2s linear infinite}

  /* misc */
  .info-box{background:linear-gradient(135deg,var(--pink-light),#fce4ee);border:1px solid var(--pink-mid);border-radius:14px;padding:14px 16px;margin-bottom:14px}
  .info-box ul{padding-left:18px;color:var(--text);font-size:.82rem;line-height:2}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--pink-deep);color:#fff;padding:9px 20px;border-radius:20px;font-size:.8rem;font-weight:700;opacity:0;transition:opacity .25s;pointer-events:none;z-index:500;white-space:nowrap;box-shadow:0 4px 16px rgba(201,52,105,.4)}
  .toast.show{opacity:1}
  .empty{text-align:center;padding:32px 16px;color:var(--muted)}
  .empty-icon{font-size:2.8rem;margin-bottom:8px}
  .empty-txt{font-weight:700;font-size:.85rem}
  .loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px;color:var(--pink-deep)}
  .spinner{width:40px;height:40px;border:3px solid var(--pink-light);border-top-color:var(--pink);border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
`

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]                   = useState('players')
  const [players,setPlayers]           = useState({})
  const [scores,setScores]             = useState({})
  const [bonuses,setBonuses]           = useState({})
  const [votes,setVotes]               = useState({})
  const [photos,setPhotos]             = useState({})
  const [groups,setGroups]             = useState({})
  const [connected,setConnected]       = useState(false)
  const [loading,setLoading]           = useState(true)
  const [newName,setNewName]           = useState('')
  const [activePid,setActivePid]       = useState(null)
  const [groupFilter,setGroupFilter]   = useState('all')
  const [bonusPid,setBonusPid]         = useState('')
  const [voterPid,setVoterPid]         = useState('')
  const [scorecardPid,setScorecardPid] = useState('')
  const [scorecardCourse,setScorecardCourse] = useState(0)
  const [lightbox,setLightbox]         = useState(null)
  const [toast,setToast]               = useState('')
  const [uploading,setUploading]       = useState(false)
  const [showConfetti,setShowConfetti] = useState(false)
  const [bonusUnlocked,setBonusUnlocked]       = useState(false)
  const [bonusPasswordInput,setBonusPasswordInput] = useState('')
  const [bonusPasswordError,setBonusPasswordError] = useState(false)
  const fileRef = useRef()

  function showToast(msg){setToast(msg);setTimeout(()=>setToast(''),2000)}

  useEffect(()=>{
    const unsubs=[]
    const listen=(path,setter)=>onValue(ref(db,path),snap=>setter(snap.val()??{}))
    unsubs.push(listen('players',setPlayers))
    unsubs.push(listen('scores',setScores))
    unsubs.push(listen('bonuses',setBonuses))
    unsubs.push(listen('votes',setVotes))
    unsubs.push(listen('photos',setPhotos))
    unsubs.push(listen('groups',setGroups))
    onValue(ref(db,'.info/connected'),snap=>{setConnected(snap.val()===true);setLoading(false)})
    return ()=>unsubs.forEach(u=>u())
  },[])

  const pList = Object.entries(players).map(([id,p])=>({id,...p}))
  useEffect(()=>{
    if(pList.length&&!activePid)  setActivePid(pList[0].id)
    if(pList.length&&!bonusPid)   setBonusPid(pList[0].id)
    if(pList.length&&!voterPid)   setVoterPid(pList[0].id)
    if(pList.length&&!scorecardPid) setScorecardPid(pList[0].id)
  },[pList.length])

  // unique groups in use
  const usedGroups = [...new Set(Object.values(groups).filter(Boolean))].sort()

  async function addPlayer(){
    const name=newName.trim();if(!name)return
    const color=PLAYER_COLORS[pList.length%PLAYER_COLORS.length]
    await set(push(ref(db,'players')),{name,color})
    setNewName('');showToast(`${name} added! 🎀`)
  }
  async function removePlayer(id){
    await remove(ref(db,`players/${id}`))
    await remove(ref(db,`scores/${id}`))
    await remove(ref(db,`bonuses/${id}`))
    await remove(ref(db,`groups/${id}`))
  }
  async function setPlayerGroup(pid,group){
    await set(ref(db,`groups/${pid}`),group||null)
  }
  async function updateScore(pid,c,h,delta){
    const next=Math.max(0,getScore(scores,pid,c,h)+delta)
    await set(ref(db,`scores/${pid}/${c}/${h}`),next)
  }
  async function toggleBonus(pid,bid){
    await set(ref(db,`bonuses/${pid}/${bid}`),!(bonuses?.[pid]?.[bid]??false))
  }
  async function castVote(forId){
    if(!voterPid||voterPid===forId)return
    await set(ref(db,`votes/${voterPid}`),forId)
    showToast('Vote cast! 🔥')
  }
  async function handleUpload(e){
    const files=Array.from(e.target.files||[]);if(!files.length)return
    setUploading(true)
    for(const f of files){
      try{const data=await resizeImage(f);await set(push(ref(db,'photos')),{data,ts:Date.now()})}
      catch(err){console.error(err)}
    }
    setUploading(false);e.target.value='';showToast('Photo uploaded! 📸')
  }
  async function deletePhoto(id){await remove(ref(db,`photos/${id}`))}
  async function resetScores(){
    if(!confirm('Reset all scores, bonuses & votes? Players and groups stay.'))return
    await set(ref(db,'scores'),{})
    await set(ref(db,'bonuses'),{})
    await set(ref(db,'votes'),{})
    showToast('Scores reset!')
  }

  // derived
  const leaderboard = pList
    .map(p=>({...p,...playerTotals(scores,bonuses,p.id)}))
    .sort((a,b)=>{
      if(!a.strokes&&!b.strokes)return 0
      if(!a.strokes)return 1;if(!b.strokes)return -1
      return a.net-b.net
    })
  const voteTally  = pList.reduce((acc,p)=>{acc[p.id]=0;return acc},{})
  Object.values(votes).forEach(fid=>{if(voteTally[fid]!==undefined)voteTally[fid]++})
  const maxVotes   = Math.max(1,...Object.values(voteTally))
  const photoList  = Object.entries(photos).map(([id,p])=>({id,...p})).sort((a,b)=>a.ts-b.ts)

  // filtered players for scoring
  const filteredPlayers = groupFilter==='all' ? pList
    : pList.filter(p=>(groups[p.id]||'none')===groupFilter)

  const TABS=[
    {id:'players',     label:'👥 Players'},
    {id:'course1',     label:'⛳ Course 1'},
    {id:'course2',     label:'⛳ Course 2'},
    {id:'scorecard',   label:'📋 Scorecard'},
    {id:'bonuses',     label:'🌟 Bonuses'},
    {id:'braai',       label:'🥩 Braai'},
    {id:'photos',      label:'📸 Photos'},
    {id:'leaderboard', label:'🏆 Board'},
    {id:'winner',      label:'🎊 Winner!'},
  ]

  // ── scoring panel ─────────────────────────────────────────────────────────
  function ScoringPanel({courseIdx}){
    const ap=pList.find(p=>p.id===activePid)
    return(
      <div>
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <span className="pill pill-pink">⛳ Course {courseIdx+1}</span>
          <span className="pill pill-pink">18 Holes · Par {PAR*HOLES}</span>
          {ap&&<span className="pill" style={{background:ap.color+'22',color:ap.color}}>Scoring: {ap.name}</span>}
        </div>

        {/* group filter */}
        {usedGroups.length>0&&(
          <div className="card" style={{padding:'12px 14px'}}>
            <div className="sec-lbl">Filter by group</div>
            <div className="gsel">
              <button className={`gsel-btn${groupFilter==='all'?' active':''}`}
                style={groupFilter==='all'?{background:'var(--pink-deep)',borderColor:'var(--pink-deep)'}:{}}
                onClick={()=>setGroupFilter('all')}>All</button>
              {usedGroups.map(g=>(
                <button key={g} className={`gsel-btn${groupFilter===g?' active':''}`}
                  style={groupFilter===g?{background:GROUP_COLORS[(parseInt(g)-1)%GROUP_COLORS.length],borderColor:'transparent'}:{}}
                  onClick={()=>setGroupFilter(g)}>{GROUP_NAMES[(parseInt(g)-1)%GROUP_NAMES.length]}</button>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="sec-lbl">Select Player to Score</div>
          <div className="psel">
            {filteredPlayers.map(p=>(
              <button key={p.id} className={`psel-btn${activePid===p.id?' active':''}`}
                style={activePid===p.id?{background:p.color,borderColor:p.color}:{}}
                onClick={()=>setActivePid(p.id)}>{p.name}</button>
            ))}
          </div>
          {filteredPlayers.length===0&&<div style={{color:'var(--muted)',fontSize:'.8rem',textAlign:'center',padding:'8px 0'}}>No players in this group yet</div>}
          {ap&&(
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#FFF5F8',borderRadius:12,marginTop:2}}>
              <div className="avatar av-sm" style={{background:ap.color}}>{ap.name[0].toUpperCase()}</div>
              <span style={{fontWeight:700,color:'var(--pink-deep)',fontSize:'.88rem'}}>{ap.name}</span>
              <span style={{marginLeft:'auto',fontWeight:700,color:'var(--muted)',fontSize:'.8rem'}}>
                Course total: <strong style={{color:'var(--pink-deep)'}}>{courseTotal(scores,ap.id,courseIdx)||'—'}</strong>
              </span>
            </div>
          )}
        </div>

        {activePid?(
          <div className="card">
            <div className="sec-lbl">Tap + / − to score each hole</div>
            {/* Front 9 */}
            <div style={{fontWeight:800,fontSize:'.7rem',color:'var(--pink-deep)',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Front 9</div>
            <div className="holes-grid" style={{marginBottom:12}}>
              {Array.from({length:9},(_,h)=>{
                const s=getScore(scores,activePid,courseIdx,h)
                const d=diffLabel(s)
                return(
                  <div key={h} className={`hole-card${s>0?' scored':''}`}>
                    <div className="hole-lbl">Hole {h+1}</div>
                    <div className="hole-par">Par {PAR}</div>
                    <div className="sc-row">
                      <button className="sc-btn sc-minus" onClick={()=>updateScore(activePid,courseIdx,h,-1)}>−</button>
                      <span className="sc-val">{s||'·'}</span>
                      <button className="sc-btn sc-plus" onClick={()=>updateScore(activePid,courseIdx,h,+1)}>+</button>
                    </div>
                    {d&&<div className={`sc-diff ${d.cls}`}>{d.label}</div>}
                  </div>
                )
              })}
            </div>
            {/* Back 9 */}
            <div style={{fontWeight:800,fontSize:'.7rem',color:'var(--pink-deep)',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Back 9</div>
            <div className="holes-grid">
              {Array.from({length:9},(_,h)=>{
                const hIdx=h+9
                const s=getScore(scores,activePid,courseIdx,hIdx)
                const d=diffLabel(s)
                return(
                  <div key={hIdx} className={`hole-card${s>0?' scored':''}`}>
                    <div className="hole-lbl">Hole {hIdx+1}</div>
                    <div className="hole-par">Par {PAR}</div>
                    <div className="sc-row">
                      <button className="sc-btn sc-minus" onClick={()=>updateScore(activePid,courseIdx,hIdx,-1)}>−</button>
                      <span className="sc-val">{s||'·'}</span>
                      <button className="sc-btn sc-plus" onClick={()=>updateScore(activePid,courseIdx,hIdx,+1)}>+</button>
                    </div>
                    {d&&<div className={`sc-diff ${d.cls}`}>{d.label}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        ):(
          <div className="empty"><div className="empty-icon">👆</div><div className="empty-txt">Select a player above</div></div>
        )}
        {!pList.length&&<div className="empty"><div className="empty-icon">👥</div><div className="empty-txt">Add players first!</div></div>}
      </div>
    )
  }

  // ── scorecard tab ─────────────────────────────────────────────────────────
  function ScorecardTab(){
    const p=pList.find(x=>x.id===scorecardPid)
    function cellClass(s){
      if(!s)return ''
      const d=s-PAR
      if(s===1)return 'sc-cell-ace'
      if(d<=-2)return 'sc-cell-eagle'
      if(d===-1)return 'sc-cell-birdie'
      if(d===1)return 'sc-cell-bogey'
      if(d>=2)return 'sc-cell-dbl'
      return ''
    }
    const playersToShow = scorecardPid==='all' ? pList : pList.filter(x=>x.id===scorecardPid)
    return(
      <div>
        <div className="card" style={{padding:'12px 14px',marginBottom:10}}>
          <div className="sec-lbl">View scorecard for</div>
          <div style={{display:'flex',gap:8}}>
            <select className="select-inp" style={{marginBottom:0,flex:1}} value={scorecardPid} onChange={e=>setScorecardPid(e.target.value)}>
              <option value="all">All Players</option>
              {pList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="select-inp" style={{marginBottom:0,flex:1}} value={scorecardCourse} onChange={e=>setScorecardCourse(Number(e.target.value))}>
              <option value={0}>Course 1</option>
              <option value={1}>Course 2</option>
            </select>
          </div>
        </div>

        {!pList.length?(
          <div className="empty"><div className="empty-icon">👥</div><div className="empty-txt">Add players first!</div></div>
        ):(
          <div className="card" style={{padding:'14px 0'}}>
            <div className="scorecard-wrap">
              <table className="scorecard-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Player</th>
                    {Array.from({length:9},(_,h)=><th key={h}>{h+1}</th>)}
                    <th style={{background:'#a0254e'}}>OUT</th>
                    {Array.from({length:9},(_,h)=><th key={h+9}>{h+10}</th>)}
                    <th style={{background:'#a0254e'}}>IN</th>
                    <th style={{background:'#7a1a38'}}>TOT</th>
                    <th style={{background:'#c97d00'}}>NET</th>
                  </tr>
                  <tr style={{background:'var(--pink-light)'}}>
                    <td className="sticky-col" style={{background:'var(--pink-light)',fontWeight:700,fontSize:'.7rem',color:'var(--muted)'}}>Par</td>
                    {Array.from({length:18},(_,h)=><td key={h} style={{color:'var(--muted)',fontWeight:600}}>{PAR}</td>)}
                    <td style={{color:'var(--muted)',fontWeight:700}}>{PAR*9}</td>
                    <td style={{color:'var(--muted)',fontWeight:700}}>{PAR*9}</td>
                    <td style={{color:'var(--muted)',fontWeight:700}}>{PAR*18}</td>
                    <td style={{color:'var(--muted)',fontWeight:700}}>—</td>
                  </tr>
                </thead>
                <tbody>
                  {playersToShow.map(pl=>{
                    const front9=Array.from({length:9},(_,h)=>getScore(scores,pl.id,scorecardCourse,h))
                    const back9=Array.from({length:9},(_,h)=>getScore(scores,pl.id,scorecardCourse,h+9))
                    const out=front9.reduce((a,b)=>a+b,0)
                    const inn=back9.reduce((a,b)=>a+b,0)
                    const tot=out+inn
                    const {bonusPts}=playerTotals(scores,bonuses,pl.id)
                    const net=playerTotals(scores,bonuses,pl.id).net
                    return(
                      <tr key={pl.id}>
                        <td className="sticky-col">
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div className="avatar av-xs" style={{background:pl.color}}>{pl.name[0].toUpperCase()}</div>
                            {pl.name}
                          </div>
                        </td>
                        {front9.map((s,h)=><td key={h} className={cellClass(s)}>{s||'·'}</td>)}
                        <td className="sc-cell-total">{out||'—'}</td>
                        {back9.map((s,h)=><td key={h+9} className={cellClass(s)}>{s||'·'}</td>)}
                        <td className="sc-cell-total">{inn||'—'}</td>
                        <td className="sc-cell-total">{tot||'—'}</td>
                        <td className="sc-cell-net">{tot>0?net:'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:'10px 18px 0',fontSize:'.68rem',color:'var(--muted)',display:'flex',gap:12,flexWrap:'wrap'}}>
              <span style={{color:'#7c3aed',fontWeight:700}}>■ ACE</span>
              <span style={{color:'#1d4ed8',fontWeight:700}}>■ Eagle</span>
              <span style={{color:'#16a34a',fontWeight:700}}>■ Birdie</span>
              <span style={{color:'var(--flame)',fontWeight:700}}>■ Bogey</span>
              <span style={{color:'#dc2626',fontWeight:700}}>■ +2 or more</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── winner screen ─────────────────────────────────────────────────────────
  function WinnerScreen(){
    const scored=leaderboard.filter(p=>p.strokes>0)
    const winner=scored[0]
    const mvBraai=Math.max(0,...Object.values(voteTally))
    const braaiWinners=pList.filter(p=>(voteTally[p.id]||0)===mvBraai&&mvBraai>0)
    return(
      <div>
        {showConfetti&&<Confetti/>}
        {!winner?(
          <div className="empty" style={{marginTop:40}}>
            <div className="empty-icon">⛳</div>
            <div className="empty-txt">No scores yet — get playing!</div>
          </div>
        ):(
          <>
            <div className="winner-screen">
              <div className="winner-crown">🏆</div>
              <div className="winner-title">Tournament Winner</div>
              <div className="winner-name">{winner.name}</div>
              <div className="winner-score">{winner.net} net strokes · {winner.strokes} total{winner.bonusPts>0?` · −${winner.bonusPts} bonus pts`:''}</div>
              <div className="winner-divider"/>

              {/* podium */}
              {scored.length>=2&&(()=>{
                const top=scored.slice(0,3)
                const order=top.length===1?[top[0]]:top.length===2?[top[1],top[0]]:[top[1],top[0],top[2]]
                return(
                  <div className="winner-podium">
                    {order.map((p,i)=>{
                      const rank=top.indexOf(p)
                      const cls=['pod-2','pod-1','pod-3'][i]
                      const medal=['🥇','🥈','🥉'][rank]
                      return(
                        <div key={p.id} className="pod-col">
                          <div className="pod-name">{p.name}</div>
                          <div className={`pod-blk ${cls}`}>
                            <div className="pod-medal">{medal}</div>
                            <div className="pod-score">{p.net}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {braaiWinners.length>0&&(
                <div style={{marginTop:24,padding:'16px 24px',background:'linear-gradient(135deg,#FFF5EE,#FFE8D0)',borderRadius:16,border:'2px solid var(--ember)',textAlign:'center',width:'100%',maxWidth:320}}>
                  <div style={{fontSize:'1.8rem'}}>👑🥩</div>
                  <div style={{fontFamily:"'Playfair Display',serif",color:'var(--flame)',fontWeight:700,fontSize:'.9rem',marginTop:4}}>Braai Master</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:'1.4rem',color:'var(--text)'}}>{braaiWinners.map(w=>w.name).join(' & ')}</div>
                </div>
              )}

              <button className="btn btn-pink" style={{marginTop:24,fontSize:'1rem',padding:'14px 32px'}}
                onClick={()=>{setShowConfetti(true);setTimeout(()=>setShowConfetti(false),5000)}}>
                🎉 Celebrate!
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  if(loading) return(
    <><style>{CSS}</style>
    <div className="loading"><div className="spinner"/>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',color:'var(--pink-deep)'}}>Connecting…</div>
    </div></>
  )

  return(
    <><style>{CSS}</style>

    <div className="hdr">
      <button className="hdr-reset" onClick={resetScores}>reset</button>
      <div className="hdr-inner">
        <div className="hdr-badge">🎀 Birthday Tournament</div>
        <div className="hdr-title">Happy <em>26th</em>,<br/>Anika! 🎉</div>
        <div className="hdr-sub">Putt Putt · Braai · Good Vibes</div>
        <div className="hdr-pills">
          <div className="hdr-pill"><span className="live-dot"/>{connected?`Live · ${pList.length} players`:'Reconnecting…'}</div>
          <div className="hdr-pill">⛳ 2 Courses · 36 Holes</div>
          <div className="hdr-pill">🎂 Turning 26</div>
        </div>
      </div>
    </div>

    <div className="tabs">
      {TABS.map(t=>(
        <button key={t.id} className={`tab${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>
      ))}
    </div>

    <div className="page">

      {/* ── PLAYERS ── */}
      {tab==='players'&&(
        <div>
          <div className="card">
            <div className="card-title">🏌️ Add Players</div>
            <div className="row">
              <input className="inp" placeholder="Enter name…" value={newName}
                onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addPlayer()}/>
              <button className="btn btn-pink" onClick={addPlayer}>Add</button>
            </div>
            <div style={{fontSize:'.73rem',color:'var(--muted)'}}>💡 Share the link — all phones see live scores instantly!</div>
          </div>

          {pList.length>0&&(
            <div className="card">
              <div className="card-title">👥 {pList.length} Players</div>
              {pList.map(p=>{
                const{strokes,bonusPts}=playerTotals(scores,bonuses,p.id)
                const g=groups[p.id]
                const gIdx=g?parseInt(g)-1:null
                return(
                  <div key={p.id} className="player-chip">
                    <div className="avatar av-lg" style={{background:p.color}}>{p.name[0].toUpperCase()}</div>
                    <div style={{flex:1}}>
                      <div className="chip-name">{p.name}</div>
                      <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap',alignItems:'center'}}>
                        {strokes>0&&<span className="pill pill-pink" style={{fontSize:'.65rem',padding:'2px 7px'}}>⛳ {strokes}</span>}
                        {bonusPts>0&&<span className="pill pill-gold" style={{fontSize:'.65rem',padding:'2px 7px'}}>🌟 −{bonusPts}</span>}
                        {g&&<span className="pill" style={{fontSize:'.65rem',padding:'2px 7px',background:GROUP_COLORS[gIdx%GROUP_COLORS.length]+'22',color:GROUP_COLORS[gIdx%GROUP_COLORS.length]}}>{GROUP_NAMES[gIdx]}</span>}
                      </div>
                    </div>
                    <select className="select-sm" value={groups[p.id]||''} onChange={e=>setPlayerGroup(p.id,e.target.value)}>
                      <option value="">No group</option>
                      {Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{GROUP_NAMES[i]}</option>)}
                    </select>
                    <button className="btn btn-danger" onClick={()=>removePlayer(p.id)}>✕</button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="info-box">
            <div style={{fontFamily:"'Playfair Display',serif",color:'var(--pink-deep)',fontWeight:700,fontSize:'1rem',marginBottom:8}}>📋 How to Play</div>
            <ul>
              <li>Add all players, then assign them to <strong>groups</strong></li>
              <li>In scoring, <strong>filter by group</strong> to find your players fast</li>
              <li>Each course has <strong>18 holes</strong> — front 9 and back 9</li>
              <li>Award <strong>🌟 Bonuses</strong> (password protected)</li>
              <li>Vote for the <strong>🥩 Braai Master</strong></li>
              <li>Check the <strong>🎊 Winner screen</strong> at the end of the day!</li>
            </ul>
          </div>
        </div>
      )}

      {tab==='course1'&&<ScoringPanel courseIdx={0}/>}
      {tab==='course2'&&<ScoringPanel courseIdx={1}/>}
      {tab==='scorecard'&&<ScorecardTab/>}

      {/* ── BONUSES locked ── */}
      {tab==='bonuses'&&!bonusUnlocked&&(
        <div>
          <div className="card" style={{textAlign:'center',padding:'32px 20px'}}>
            <div style={{fontSize:'2.5rem',marginBottom:12}}>🔒</div>
            <div style={{fontFamily:"'Playfair Display',serif",color:'var(--pink-deep)',fontSize:'1.2rem',fontWeight:700,marginBottom:6}}>Bonuses are locked</div>
            <div style={{color:'var(--muted)',fontSize:'.82rem',marginBottom:20}}>Only the birthday girl can award bonus points 🎀</div>
            <input className="inp" type="password" placeholder="Enter password…"
              value={bonusPasswordInput}
              onChange={e=>{setBonusPasswordInput(e.target.value);setBonusPasswordError(false)}}
              onKeyDown={e=>{if(e.key==='Enter'){if(bonusPasswordInput==='!Password@2405'){setBonusUnlocked(true);setBonusPasswordInput('')}else setBonusPasswordError(true)}}}
              style={{marginBottom:10,textAlign:'center'}}/>
            {bonusPasswordError&&<div style={{color:'#c0392b',fontSize:'.78rem',fontWeight:700,marginBottom:10}}>❌ Wrong password — only Anika can do this!</div>}
            <button className="btn btn-pink" style={{width:'100%'}} onClick={()=>{
              if(bonusPasswordInput==='!Password@2405'){setBonusUnlocked(true);setBonusPasswordInput('')}
              else setBonusPasswordError(true)
            }}>Unlock Bonuses</button>
          </div>
        </div>
      )}

      {/* ── BONUSES unlocked ── */}
      {tab==='bonuses'&&bonusUnlocked&&(
        <div>
          <div className="card">
            <div className="card-title">🌟 Award Bonus Points</div>
            <div className="sec-lbl">Awarding to</div>
            <select className="select-inp" value={bonusPid} onChange={e=>setBonusPid(e.target.value)}>
              {pList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {bonusPid&&(()=>{
              const p=pList.find(x=>x.id===bonusPid)
              const awarded=bonuses?.[bonusPid]??{}
              const total=Object.keys(awarded).filter(k=>awarded[k]).reduce((s,k)=>{const b=BONUS_LIST.find(x=>x.id===k);return s+(b?b.pts:0)},0)
              return(
                <>
                  {p&&(
                    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--pink-light)',borderRadius:12,marginBottom:14}}>
                      <div className="avatar av-sm" style={{background:p.color}}>{p.name[0].toUpperCase()}</div>
                      <span style={{fontWeight:700,color:'var(--pink-deep)'}}>{p.name}</span>
                      <span style={{marginLeft:'auto',fontFamily:"'Playfair Display',serif",color:'var(--flame)',fontWeight:700}}>🌟 −{total} pts</span>
                    </div>
                  )}
                  <div className="bonus-grid">
                    {BONUS_LIST.map(b=>{
                      const on=bonuses?.[bonusPid]?.[b.id]??false
                      return(
                        <div key={b.id} className={`bonus-card${on?' on':''}`} onClick={()=>toggleBonus(bonusPid,b.id)}>
                          <div className="bonus-icon">{b.icon}</div>
                          <div className="bonus-lbl">{b.label}</div>
                          <div className="bonus-pts">−{b.pts} pts {on?'✓':''}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{textAlign:'center',fontSize:'.7rem',color:'var(--muted)',marginTop:10}}>Tap to toggle · Bonus points subtract from total strokes</div>
                </>
              )
            })()}
            {!pList.length&&<div className="empty" style={{padding:'16px 0'}}><div className="empty-icon">👥</div><div className="empty-txt">Add players first!</div></div>}
          </div>
          {pList.some(p=>Object.values(bonuses?.[p.id]??{}).some(Boolean))&&(
            <div className="card">
              <div className="card-title">✨ All Bonuses Awarded</div>
              {pList.map(p=>{
                const awarded=Object.entries(bonuses?.[p.id]??{}).filter(([,v])=>v).map(([k])=>k)
                if(!awarded.length)return null
                return(
                  <div key={p.id} style={{marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:'.8rem',marginBottom:5,color:'var(--muted)'}}>{p.name}</div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {awarded.map(bid=>{const b=BONUS_LIST.find(x=>x.id===bid);return b?<span key={bid} className="pill pill-gold">{b.icon} {b.label} −{b.pts}</span>:null})}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={()=>setBonusUnlocked(false)}
            style={{display:'block',margin:'0 auto',background:'none',border:'none',color:'var(--muted)',fontSize:'.75rem',cursor:'pointer',padding:'8px'}}>
            🔒 Lock bonuses
          </button>
        </div>
      )}

      {/* ── BRAAI VOTE ── */}
      {tab==='braai'&&(
        <div>
          <div className="card" style={{background:'linear-gradient(135deg,#FFF5EE,#FFF8F0)',borderColor:'#ffe0c4'}}>
            <div className="card-title" style={{color:'var(--flame)'}}>🥩 Vote: Braai Master</div>
            <div style={{fontSize:'.82rem',color:'var(--muted)',marginBottom:14}}>Who's owning the braai today? One vote per person!</div>
            <div className="sec-lbl">I am</div>
            <select className="select-inp" value={voterPid} onChange={e=>setVoterPid(e.target.value)}>
              {pList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="sec-lbl">Vote for</div>
            {!pList.length&&<div className="empty" style={{padding:'16px 0'}}><div className="empty-icon">👥</div><div className="empty-txt">Add players first!</div></div>}
            {pList.map(p=>{
              const count=voteTally[p.id]||0
              const pct=Math.round((count/maxVotes)*100)
              const isMyVote=votes?.[voterPid]===p.id
              return(
                <div key={p.id} className={`vote-card${isMyVote?' my-vote':''}`} onClick={()=>castVote(p.id)}>
                  <span style={{fontSize:'1.6rem'}}>🔥</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div className="avatar av-sm" style={{background:p.color}}>{p.name[0].toUpperCase()}</div>
                      <span style={{fontWeight:700,fontSize:'.92rem',flex:1}}>{p.name}</span>
                      <span style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',color:'var(--flame)',fontWeight:700}}>{count} {count===1?'vote':'votes'}</span>
                      {isMyVote&&<span className="pill pill-flame">Your vote ✓</span>}
                    </div>
                    <div className="vote-bar"><div className="vote-bar-fill" style={{width:`${pct}%`}}/></div>
                  </div>
                </div>
              )
            })}
          </div>
          {(()=>{
            const mv=Math.max(0,...Object.values(voteTally));if(!mv)return null
            const winners=pList.filter(p=>(voteTally[p.id]||0)===mv)
            return(
              <div className="card" style={{textAlign:'center',background:'linear-gradient(135deg,#FFF5EE,#FFE8D0)',borderColor:'var(--ember)'}}>
                <div style={{fontSize:'2.5rem',marginBottom:6}}>👑</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',color:'var(--flame)',fontWeight:700,marginBottom:4}}>Braai Master{winners.length>1?'s':''}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.6rem',fontWeight:900,color:'var(--text)'}}>{winners.map(w=>w.name).join(' & ')}</div>
                <div style={{fontSize:'.75rem',color:'var(--muted)',marginTop:4}}>🔥 {mv} vote{mv!==1?'s':''}</div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── PHOTOS ── */}
      {tab==='photos'&&(
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleUpload}/>
          <div className="upload-zone" onClick={()=>fileRef.current?.click()}>
            <div style={{fontSize:'2rem',marginBottom:8}}>{uploading?'⏳':'📸'}</div>
            <div style={{fontWeight:700,color:'var(--pink-deep)',fontSize:'.88rem'}}>{uploading?'Uploading…':'Tap to Add Photos'}</div>
            <div style={{color:'var(--muted)',fontSize:'.72rem',marginTop:4}}>Any phone can upload. All phones see them instantly!</div>
          </div>
          {photoList.length===0&&!uploading&&<div className="empty"><div className="empty-icon">🌸</div><div className="empty-txt">No photos yet — be the first!</div></div>}
          {photoList.length>0&&(
            <div className="card">
              <div className="card-title">🌸 {photoList.length} Memor{photoList.length!==1?'ies':'y'} from the Day</div>
              <div className="photo-grid">
                {photoList.map((ph,i)=>(
                  <div key={ph.id} className="photo-thumb" onClick={()=>setLightbox(ph.data)}>
                    <img src={ph.data} alt={`Photo ${i+1}`} loading="lazy"/>
                    <div className="photo-overlay">
                      <span style={{fontSize:'.65rem',color:'rgba(255,255,255,.85)',fontWeight:600,flex:1}}>#{i+1}</span>
                      <button className="photo-del-btn" onClick={e=>{e.stopPropagation();deletePhoto(ph.id)}}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {tab==='leaderboard'&&(
        <div>
          <div style={{textAlign:'center',marginBottom:16}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',color:'var(--pink-deep)',fontWeight:900}}>🏆 Tournament Board</div>
            <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:4}}>Lower net score wins · Bonus points reduce strokes · Updates live</div>
          </div>
          {!pList.length&&<div className="empty"><div className="empty-icon">⛳</div><div className="empty-txt">No players yet!</div></div>}
          {leaderboard.filter(p=>p.strokes>0).length>=2&&(()=>{
            const top=leaderboard.filter(p=>p.strokes>0).slice(0,3)
            const order=top.length===1?[top[0]]:top.length===2?[top[1],top[0]]:[top[1],top[0],top[2]]
            return(
              <div className="podium-wrap">
                {order.map((p,i)=>{
                  const rank=top.indexOf(p)
                  const cls=['pod-2','pod-1','pod-3'][i]
                  const medal=['🥇','🥈','🥉'][rank]
                  return(
                    <div key={p.id} className="pod-col">
                      <div className="pod-name">{p.name}</div>
                      <div className={`pod-blk ${cls}`}><div className="pod-medal">{medal}</div><div className="pod-score">{p.net}</div></div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          {leaderboard.map((p,i)=>(
            <div key={p.id} className={`lb-row${i===0&&p.strokes>0?' top':''}`}>
              <div className="lb-rank">{p.strokes===0?'—':i===0?'🏆':i===1?'🥈':i===2?'🥉':`#${i+1}`}</div>
              <div className="avatar av-sm" style={{background:p.color}}>{p.name[0].toUpperCase()}</div>
              <div className="lb-name">{p.name}</div>
              <div className="lb-right">
                {p.strokes>0?(
                  <>
                    <div className={`lb-net${i===0?' winner-shimmer':''}`}>{p.net} net</div>
                    <div className="lb-tiny">{p.strokes} strokes{p.bonusPts>0&&<span className="lb-bonus-tag" style={{marginLeft:4}}>−{p.bonusPts} bonus</span>}</div>
                  </>
                ):<div className="lb-tiny">No scores yet</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── WINNER ── */}
      {tab==='winner'&&<WinnerScreen/>}
    </div>

    {lightbox&&(
      <div className="lightbox" onClick={()=>setLightbox(null)}>
        <button className="lightbox-close">✕</button>
        <img src={lightbox} alt="Memory" onClick={e=>e.stopPropagation()}/>
      </div>
    )}
    <div className={`toast${toast?' show':''}`}>{toast}</div>
    </>
  )
}
