import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set, remove, push } from 'firebase/database'
import { db } from './firebase.js'

const PAR   = 3
const HOLES = 9
const PLAYER_COLORS = [
  '#F2578A','#C93469','#FF6B35','#9B59B6',
  '#2196F3','#16a34a','#E91E63','#FF9800','#00BCD4','#8BC34A',
]
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

function getScore(scores, pid, c, h) { return scores?.[pid]?.[c]?.[h] ?? 0 }
function courseTotal(scores, pid, c) {
  let t = 0; for (let h = 0; h < HOLES; h++) t += getScore(scores, pid, c, h); return t
}
function playerTotals(scores, bonuses, pid) {
  const strokes  = courseTotal(scores, pid, 0) + courseTotal(scores, pid, 1)
  const bonusPts = Object.keys(bonuses?.[pid] ?? {})
    .filter(k => bonuses[pid][k])
    .reduce((s, k) => { const b = BONUS_LIST.find(x => x.id === k); return s + (b ? b.pts : 0) }, 0)
  return { strokes, bonusPts, net: strokes - bonusPts }
}
function diffLabel(s) {
  if (!s) return null
  const d = s - PAR
  if (s === 1)  return { label: 'ACE! 🕳️',  cls: 'diff-ace'    }
  if (d <= -2)  return { label: 'Eagle 🦅',  cls: 'diff-eagle'  }
  if (d === -1) return { label: 'Birdie 🐦', cls: 'diff-birdie' }
  if (d === 0)  return { label: 'Par ✓',      cls: 'diff-par'    }
  if (d === 1)  return { label: '+1 Bogey',  cls: 'diff-bogey'  }
  return               { label: `+${d}`,      cls: 'diff-dbl'    }
}
function resizeImage(file) {
  return new Promise(res => {
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width, h = img.height, MAX = 600
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else       { w = Math.round(w * MAX / h); h = MAX }
      }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/jpeg', 0.65))
    }
    img.src = url
  })
}

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

  .psel{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
  .psel-btn{padding:6px 14px;border-radius:20px;border:2px solid var(--pink-mid);background:#fff;font-family:'DM Sans',sans-serif;font-weight:600;font-size:.8rem;cursor:pointer;transition:all .2s;color:var(--muted)}
  .psel-btn.active{color:#fff;border-color:transparent}

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

  .bonus-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .bonus-card{border:2px solid #f0e0e6;border-radius:14px;padding:12px 10px;text-align:center;cursor:pointer;transition:all .2s;background:#fffafc}
  .bonus-card.on{background:linear-gradient(135deg,#FFF8D6,#FFFBE8);border-color:var(--gold)}
  .bonus-card:hover{border-color:var(--pink);transform:translateY(-1px)}
  .bonus-icon{font-size:1.6rem;margin-bottom:4px}
  .bonus-lbl{font-size:.73rem;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:3px}
  .bonus-pts{font-family:'Playfair Display',serif;font-size:.85rem;color:var(--flame);font-weight:700}

  .vote-card{border:2px solid #ffe0c4;border-radius:16px;padding:14px;background:linear-gradient(135deg,#FFF5EE,#FFF8F0);margin-bottom:10px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px}
  .vote-card:hover{border-color:var(--flame);transform:translateY(-1px)}
  .vote-card.my-vote{border-color:var(--flame);background:linear-gradient(135deg,#FFF0E6,#FFE8D4);box-shadow:0 2px 12px rgba(255,107,53,.2)}
  .vote-bar{height:4px;background:#ffe0c4;border-radius:2px;margin-top:8px}
  .vote-bar-fill{height:100%;background:linear-gradient(90deg,var(--ember),var(--flame));border-radius:2px;transition:width .4s}

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
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  .winner-shimmer{background:linear-gradient(90deg,var(--pink),var(--gold),var(--pink));background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 2.5s linear infinite}
`

export default function App() {
  const [tab, setTab]             = useState('players')
  const [players, setPlayers]     = useState({})
  const [scores, setScores]       = useState({})
  const [bonuses, setBonuses]     = useState({})
  const [votes, setVotes]         = useState({})
  const [photos, setPhotos]       = useState({})
  const [connected, setConnected] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [newName, setNewName]     = useState('')
  const [activePid, setActivePid] = useState(null)
  const [bonusPid, setBonusPid]   = useState('')
  const [voterPid, setVoterPid]   = useState('')
  const [lightbox, setLightbox]   = useState(null)
  const [toast, setToast]         = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  useEffect(() => {
    const unsubs = []
    const listen = (path, setter) => onValue(ref(db, path), snap => setter(snap.val() ?? {}))
    unsubs.push(listen('players', setPlayers))
    unsubs.push(listen('scores',  setScores))
    unsubs.push(listen('bonuses', setBonuses))
    unsubs.push(listen('votes',   setVotes))
    unsubs.push(listen('photos',  setPhotos))
    onValue(ref(db, '.info/connected'), snap => {
      setConnected(snap.val() === true); setLoading(false)
    })
    return () => unsubs.forEach(u => u())
  }, [])

  const pList = Object.entries(players).map(([id, p]) => ({ id, ...p }))
  useEffect(() => {
    if (pList.length && !activePid) setActivePid(pList[0].id)
    if (pList.length && !bonusPid)  setBonusPid(pList[0].id)
    if (pList.length && !voterPid)  setVoterPid(pList[0].id)
  }, [pList.length])

  async function addPlayer() {
    const name = newName.trim(); if (!name) return
    const color = PLAYER_COLORS[pList.length % PLAYER_COLORS.length]
    await set(push(ref(db, 'players')), { name, color })
    setNewName(''); showToast(`${name} added! 🎀`)
  }
  async function removePlayer(id) {
    await remove(ref(db, `players/${id}`))
    await remove(ref(db, `scores/${id}`))
    await remove(ref(db, `bonuses/${id}`))
  }
  async function updateScore(pid, c, h, delta) {
    const next = Math.max(0, getScore(scores, pid, c, h) + delta)
    await set(ref(db, `scores/${pid}/${c}/${h}`), next)
  }
  async function toggleBonus(pid, bid) {
    await set(ref(db, `bonuses/${pid}/${bid}`), !(bonuses?.[pid]?.[bid] ?? false))
  }
  async function castVote(forId) {
    if (!voterPid || voterPid === forId) return
    await set(ref(db, `votes/${voterPid}`), forId)
    showToast('Vote cast! 🔥')
  }
  async function handleUpload(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setUploading(true)
    for (const f of files) {
      try {
        const data = await resizeImage(f)
        await set(push(ref(db, 'photos')), { data, ts: Date.now() })
      } catch (err) { console.error(err) }
    }
    setUploading(false); e.target.value = ''
    showToast('Photo uploaded! 📸')
  }
  async function deletePhoto(photoId) {
    await remove(ref(db, `photos/${photoId}`))
  }
  async function resetScores() {
    if (!confirm('Reset all scores, bonuses & votes? Players will be kept.')) return
    await set(ref(db, 'scores'),  {})
    await set(ref(db, 'bonuses'), {})
    await set(ref(db, 'votes'),   {})
    showToast('Scores reset!')
  }

  const leaderboard = pList
    .map(p => ({ ...p, ...playerTotals(scores, bonuses, p.id) }))
    .sort((a, b) => {
      if (!a.strokes && !b.strokes) return 0
      if (!a.strokes) return 1; if (!b.strokes) return -1
      return a.net - b.net
    })

  const voteTally = pList.reduce((acc, p) => { acc[p.id] = 0; return acc }, {})
  Object.values(votes).forEach(fid => { if (voteTally[fid] !== undefined) voteTally[fid]++ })
  const maxVotes  = Math.max(1, ...Object.values(voteTally))
  const photoList = Object.entries(photos).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.ts - b.ts)

  const TABS = [
    { id:'players',     label:'👥 Players'   },
    { id:'course1',     label:'⛳ Course 1'   },
    { id:'course2',     label:'⛳ Course 2'   },
    { id:'bonuses',     label:'🌟 Bonuses'   },
    { id:'braai',       label:'🥩 Braai Vote' },
    { id:'photos',      label:'📸 Photos'    },
    { id:'leaderboard', label:'🏆 Board'     },
  ]

  function ScoringPanel({ courseIdx }) {
    const ap = pList.find(p => p.id === activePid)
    return (
      <div>
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          <span className="pill pill-pink">⛳ Course {courseIdx + 1}</span>
          <span className="pill pill-pink">9 Holes · Par {PAR * HOLES}</span>
          {ap && <span className="pill" style={{ background: ap.color + '22', color: ap.color }}>Scoring: {ap.name}</span>}
        </div>
        <div className="card">
          <div className="sec-lbl">Select Player to Score</div>
          <div className="psel">
            {pList.map(p => (
              <button key={p.id} className={`psel-btn${activePid === p.id ? ' active' : ''}`}
                style={activePid === p.id ? { background: p.color, borderColor: p.color } : {}}
                onClick={() => setActivePid(p.id)}>{p.name}
              </button>
            ))}
          </div>
          {ap && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#FFF5F8', borderRadius:12, marginTop:2 }}>
              <div className="avatar av-sm" style={{ background: ap.color }}>{ap.name[0].toUpperCase()}</div>
              <span style={{ fontWeight:700, color:'var(--pink-deep)', fontSize:'.88rem' }}>{ap.name}</span>
              <span style={{ marginLeft:'auto', fontWeight:700, color:'var(--muted)', fontSize:'.8rem' }}>
                Course total: <strong style={{ color:'var(--pink-deep)' }}>{courseTotal(scores, ap.id, courseIdx) || '—'}</strong>
              </span>
            </div>
          )}
        </div>
        {activePid ? (
          <div className="card">
            <div className="sec-lbl">Tap + / − to score each hole</div>
            <div className="holes-grid">
              {Array.from({ length: HOLES }, (_, h) => {
                const s = getScore(scores, activePid, courseIdx, h)
                const d = diffLabel(s)
                return (
                  <div key={h} className={`hole-card${s > 0 ? ' scored' : ''}`}>
                    <div className="hole-lbl">Hole {h + 1}</div>
                    <div className="hole-par">Par {PAR}</div>
                    <div className="sc-row">
                      <button className="sc-btn sc-minus" onClick={() => updateScore(activePid, courseIdx, h, -1)}>−</button>
                      <span className="sc-val">{s || '·'}</span>
                      <button className="sc-btn sc-plus"  onClick={() => updateScore(activePid, courseIdx, h, +1)}>+</button>
                    </div>
                    {d && <div className={`sc-diff ${d.cls}`}>{d.label}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="empty"><div className="empty-icon">👆</div><div className="empty-txt">Select a player above</div></div>
        )}
        {!pList.length && <div className="empty"><div className="empty-icon">👥</div><div className="empty-txt">Add players first!</div></div>}
      </div>
    )
  }

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="loading">
        <div className="spinner"/>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', color:'var(--pink-deep)' }}>Connecting…</div>
      </div>
    </>
  )

  return (
    <>
      <style>{CSS}</style>
      <div className="hdr">
        <button className="hdr-reset" onClick={resetScores}>reset</button>
        <div className="hdr-inner">
          <div className="hdr-badge">🎀 Birthday Tournament</div>
          <div className="hdr-title">Happy <em>26th</em>,<br />Anika! 🎉</div>
          <div className="hdr-sub">Putt Putt · Braai · Good Vibes</div>
          <div className="hdr-pills">
            <div className="hdr-pill"><span className="live-dot"/>{connected ? `Live · ${pList.length} players` : 'Reconnecting…'}</div>
            <div className="hdr-pill">⛳ 2 Courses · 18 Holes</div>
            <div className="hdr-pill">🎂 Turning 26</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="page">
        {tab === 'players' && (
          <div>
            <div className="card">
              <div className="card-title">🏌️ Add Players</div>
              <div className="row">
                <input className="inp" placeholder="Enter name…" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPlayer()} />
                <button className="btn btn-pink" onClick={addPlayer}>Add</button>
              </div>
              <div style={{ fontSize:'.73rem', color:'var(--muted)' }}>💡 Share the link — all phones see live scores instantly!</div>
            </div>
            {pList.length > 0 && (
              <div className="card">
                <div className="card-title">👥 {pList.length} Players</div>
                {pList.map(p => {
                  const { strokes, bonusPts } = playerTotals(scores, bonuses, p.id)
                  return (
                    <div key={p.id} className="player-chip">
                      <div className="avatar av-lg" style={{ background: p.color }}>{p.name[0].toUpperCase()}</div>
                      <div className="chip-name">{p.name}</div>
                      {strokes > 0 && <span className="pill pill-pink">⛳ {strokes}</span>}
                      {bonusPts > 0 && <span className="pill pill-gold">🌟 −{bonusPts}</span>}
                      <button className="btn btn-danger" onClick={() => removePlayer(p.id)}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="info-box">
              <div style={{ fontFamily:"'Playfair Display',serif", color:'var(--pink-deep)', fontWeight:700, fontSize:'1rem', marginBottom:8 }}>📋 How to Play</div>
              <ul>
                <li>Everyone opens the <strong>same URL</strong> on their phone</li>
                <li>Go to <strong>Course 1 or 2</strong> — pick a player and tap +/−</li>
                <li>Award <strong>🌟 Bonuses</strong> anytime — they reduce stroke totals</li>
                <li>Vote for the <strong>🥩 Braai Master</strong></li>
                <li><strong>📸 Upload photos</strong> all day from any phone</li>
                <li>Lowest <strong>net score</strong> wins 🏆</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'course1' && <ScoringPanel courseIdx={0} />}
        {tab === 'course2' && <ScoringPanel courseIdx={1} />}

        {tab === 'bonuses' && (
          <div>
            <div className="card">
              <div className="card-title">🌟 Award Bonus Points</div>
              <div className="sec-lbl">Awarding to</div>
              <select className="select-inp" value={bonusPid} onChange={e => setBonusPid(e.target.value)}>
                {pList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {bonusPid && (() => {
                const p       = pList.find(x => x.id === bonusPid)
                const awarded = bonuses?.[bonusPid] ?? {}
                const total   = Object.keys(awarded).filter(k => awarded[k]).reduce((s, k) => { const b = BONUS_LIST.find(x => x.id === k); return s + (b ? b.pts : 0) }, 0)
                return (
                  <>
                    {p && (
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--pink-light)', borderRadius:12, marginBottom:14 }}>
                        <div className="avatar av-sm" style={{ background: p.color }}>{p.name[0].toUpperCase()}</div>
                        <span style={{ fontWeight:700, color:'var(--pink-deep)' }}>{p.name}</span>
                        <span style={{ marginLeft:'auto', fontFamily:"'Playfair Display',serif", color:'var(--flame)', fontWeight:700 }}>🌟 −{total} pts</span>
                      </div>
                    )}
                    <div className="bonus-grid">
                      {BONUS_LIST.map(b => {
                        const on = bonuses?.[bonusPid]?.[b.id] ?? false
                        return (
                          <div key={b.id} className={`bonus-card${on ? ' on' : ''}`} onClick={() => toggleBonus(bonusPid, b.id)}>
                            <div className="bonus-icon">{b.icon}</div>
                            <div className="bonus-lbl">{b.label}</div>
                            <div className="bonus-pts">−{b.pts} pts {on ? '✓' : ''}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ textAlign:'center', fontSize:'.7rem', color:'var(--muted)', marginTop:10 }}>Tap to toggle · Bonus points subtract from total strokes</div>
                  </>
                )
              })()}
              {!pList.length && <div className="empty" style={{ padding:'16px 0' }}><div className="empty-icon">👥</div><div className="empty-txt">Add players first!</div></div>}
            </div>
            {pList.some(p => Object.values(bonuses?.[p.id] ?? {}).some(Boolean)) && (
              <div className="card">
                <div className="card-title">✨ All Bonuses Awarded</div>
                {pList.map(p => {
                  const awarded = Object.entries(bonuses?.[p.id] ?? {}).filter(([, v]) => v).map(([k]) => k)
                  if (!awarded.length) return null
                  return (
                    <div key={p.id} style={{ marginBottom:12 }}>
                      <div style={{ fontWeight:700, fontSize:'.8rem', marginBottom:5, color:'var(--muted)' }}>{p.name}</div>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {awarded.map(bid => { const b = BONUS_LIST.find(x => x.id === bid); return b ? <span key={bid} className="pill pill-gold">{b.icon} {b.label} −{b.pts}</span> : null })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'braai' && (
          <div>
            <div className="card" style={{ background:'linear-gradient(135deg,#FFF5EE,#FFF8F0)', borderColor:'#ffe0c4' }}>
              <div className="card-title" style={{ color:'var(--flame)' }}>🥩 Vote: Braai Master</div>
              <div style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:14 }}>Who's owning the braai today? One vote per person!</div>
              <div className="sec-lbl">I am</div>
              <select className="select-inp" value={voterPid} onChange={e => setVoterPid(e.target.value)}>
                {pList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="sec-lbl">Vote for</div>
              {!pList.length && <div className="empty" style={{ padding:'16px 0' }}><div className="empty-icon">👥</div><div className="empty-txt">Add players first!</div></div>}
              {pList.map(p => {
                const count    = voteTally[p.id] || 0
                const pct      = Math.round((count / maxVotes) * 100)
                const isMyVote = votes?.[voterPid] === p.id
                return (
                  <div key={p.id} className={`vote-card${isMyVote ? ' my-vote' : ''}`} onClick={() => castVote(p.id)}>
                    <span style={{ fontSize:'1.6rem' }}>🔥</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="avatar av-sm" style={{ background: p.color }}>{p.name[0].toUpperCase()}</div>
                        <span style={{ fontWeight:700, fontSize:'.92rem', flex:1 }}>{p.name}</span>
                        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', color:'var(--flame)', fontWeight:700 }}>{count} {count === 1 ? 'vote' : 'votes'}</span>
                        {isMyVote && <span className="pill pill-flame">Your vote ✓</span>}
                      </div>
                      <div className="vote-bar"><div className="vote-bar-fill" style={{ width:`${pct}%` }}/></div>
                    </div>
                  </div>
                )
              })}
            </div>
            {(() => {
              const mv = Math.max(0, ...Object.values(voteTally))
              if (!mv) return null
              const winners = pList.filter(p => (voteTally[p.id] || 0) === mv)
              return (
                <div className="card" style={{ textAlign:'center', background:'linear-gradient(135deg,#FFF5EE,#FFE8D0)', borderColor:'var(--ember)' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:6 }}>👑</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', color:'var(--flame)', fontWeight:700, marginBottom:4 }}>Braai Master{winners.length > 1 ? 's' : ''}</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.6rem', fontWeight:900, color:'var(--text)' }}>{winners.map(w => w.name).join(' & ')}</div>
                  <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:4 }}>🔥 {mv} vote{mv !== 1 ? 's' : ''}</div>
                </div>
              )
            })()}
          </div>
        )}

        {tab === 'photos' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={handleUpload} />
            <div className="upload-zone" onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>{uploading ? '⏳' : '📸'}</div>
              <div style={{ fontWeight:700, color:'var(--pink-deep)', fontSize:'.88rem' }}>{uploading ? 'Uploading…' : 'Tap to Add Photos'}</div>
              <div style={{ color:'var(--muted)', fontSize:'.72rem', marginTop:4 }}>Any phone can upload. All phones see them instantly!</div>
            </div>
            {photoList.length === 0 && !uploading && (
              <div className="empty"><div className="empty-icon">🌸</div><div className="empty-txt">No photos yet — be the first!</div></div>
            )}
            {photoList.length > 0 && (
              <div className="card">
                <div className="card-title">🌸 {photoList.length} Memor{photoList.length !== 1 ? 'ies' : 'y'} from the Day</div>
                <div className="photo-grid">
                  {photoList.map((ph, i) => (
                    <div key={ph.id} className="photo-thumb" onClick={() => setLightbox(ph.data)}>
                      <img src={ph.data} alt={`Photo ${i + 1}`} loading="lazy" />
                      <div className="photo-overlay">
                        <span style={{ fontSize:'.65rem', color:'rgba(255,255,255,.85)', fontWeight:600, flex:1 }}>#{i + 1}</span>
                        <button className="photo-del-btn" onClick={e => { e.stopPropagation(); deletePhoto(ph.id) }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'leaderboard' && (
          <div>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', color:'var(--pink-deep)', fontWeight:900 }}>🏆 Tournament Board</div>
              <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:4 }}>Lower net score wins · Bonus points reduce strokes · Updates live</div>
            </div>
            {!pList.length && <div className="empty"><div className="empty-icon">⛳</div><div className="empty-txt">No players yet!</div></div>}
            {leaderboard.filter(p => p.strokes > 0).length >= 2 && (() => {
              const top   = leaderboard.filter(p => p.strokes > 0).slice(0, 3)
              const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]]
              return (
                <div className="podium-wrap">
                  {order.map((p, i) => {
                    const rank = top.indexOf(p)
                    const cls  = ['pod-2','pod-1','pod-3'][i]
                    const medal= ['🥇','🥈','🥉'][rank]
                    return (
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
            {leaderboard.map((p, i) => (
              <div key={p.id} className={`lb-row${i === 0 && p.strokes > 0 ? ' top' : ''}`}>
                <div className="lb-rank">{p.strokes === 0 ? '—' : i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</div>
                <div className="avatar av-sm" style={{ background: p.color }}>{p.name[0].toUpperCase()}</div>
                <div className="lb-name">{p.name}</div>
                <div className="lb-right">
                  {p.strokes > 0 ? (
                    <>
                      <div className={`lb-net${i === 0 ? ' winner-shimmer' : ''}`}>{p.net} net</div>
                      <div className="lb-tiny">{p.strokes} strokes{p.bonusPts > 0 && <span className="lb-bonus-tag" style={{ marginLeft:4 }}>−{p.bonusPts} bonus</span>}</div>
                    </>
                  ) : <div className="lb-tiny">No scores yet</div>}
                </div>
              </div>
            ))}
            {pList.length > 0 && (
              <div className="card" style={{ marginTop:16 }}>
                <div className="card-title">📊 Breakdown</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom:'2px solid var(--pink-light)' }}>
                        <th style={{ textAlign:'left', padding:'6px 8px', color:'var(--muted)', fontWeight:700 }}>Player</th>
                        <th style={{ padding:'6px 8px', color:'var(--muted)', fontWeight:700 }}>C1</th>
                        <th style={{ padding:'6px 8px', color:'var(--muted)', fontWeight:700 }}>C2</th>
                        <th style={{ padding:'6px 8px', color:'var(--flame)', fontWeight:700 }}>Bonus</th>
                        <th style={{ padding:'6px 8px', color:'var(--pink-deep)', fontWeight:800 }}>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map(p => (
                        <tr key={p.id} style={{ borderBottom:'1px solid var(--pink-light)' }}>
                          <td style={{ padding:'7px 8px', fontWeight:700 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div className="avatar av-xs" style={{ background: p.color }}>{p.name[0].toUpperCase()}</div>
                              {p.name}
                            </div>
                          </td>
                          <td style={{ padding:'7px 8px', textAlign:'center' }}>{courseTotal(scores, p.id, 0) || '—'}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center' }}>{courseTotal(scores, p.id, 1) || '—'}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center', color:'var(--flame)', fontWeight:700 }}>{p.bonusPts > 0 ? `−${p.bonusPts}` : '—'}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center', fontFamily:"'Playfair Display',serif", fontWeight:700, color:'var(--pink-deep)' }}>{p.strokes > 0 ? p.net : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close">✕</button>
          <img src={lightbox} alt="Memory" onClick={e => e.stopPropagation()} />
        </div>
      )}
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  )
}
