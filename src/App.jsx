import React,{useEffect,useMemo,useState}from'react'
import{CalendarDays,ChevronLeft,ChevronRight,RefreshCw,Search,Settings,UserRoundCheck,Users}from'lucide-react'

const PEOPLE_KEY='cpsr-people-v4', CLAIMS_KEY='cpsr-claims-v4'
const defaultPeople=['Jennifer Cabading','Maisie Chandler','Samantha Gallen','Acille Kabbara','Dharshni Rangarajan','Chester Viernes','Curtis Wise-Lancaster']
const slotPattern={Tuesday:['13:00','14:00'],Wednesday:['09:00','10:00','11:00'],Thursday:['09:00','10:00','11:00'],Friday:['13:00','14:00']}
const days=['Tuesday','Wednesday','Thursday','Friday']
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
const dateOnly=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate())
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x}
const mondayOf=d=>{const x=dateOnly(d),day=x.getDay()||7;return addDays(x,1-day)}
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const displayTime=t=>new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit'}).format(new Date(2026,0,1,+t.slice(0,2),+t.slice(3)))
const dayIndex={Tuesday:1,Wednesday:2,Thursday:3,Friday:4}

export default function App(){
 const [week,setWeek]=useState(mondayOf(new Date()))
 const [events,setEvents]=useState([]),[sync,setSync]=useState({state:'idle',message:'Not checked yet'})
 const [claims,setClaims]=useState(()=>load(CLAIMS_KEY,{})),[people,setPeople]=useState(()=>load(PEOPLE_KEY,defaultPeople))
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState('')
 useEffect(()=>localStorage.setItem(CLAIMS_KEY,JSON.stringify(claims)),[claims])
 useEffect(()=>localStorage.setItem(PEOPLE_KEY,JSON.stringify(people)),[people])
 const fetchWeek=async()=>{setSync({state:'loading',message:'Checking live calendar…'});try{const r=await fetch(`/api/calendar?week=${iso(week)}`),j=await r.json();if(!j.ok)throw new Error(j.error);setEvents(j.events||[]);setSync({state:'ok',message:`${j.events.length} busy slot${j.events.length===1?'':'s'} loaded`})}catch(e){setSync({state:'error',message:`Calendar unavailable: ${e.message}`})}}
 useEffect(()=>{fetchWeek();const timer=setInterval(fetchWeek,300000);return()=>clearInterval(timer)},[iso(week)])
 const slots=useMemo(()=>days.flatMap(day=>slotPattern[day].map(time=>{const date=iso(addDays(week,dayIndex[day])),key=`${date}|${time}`,event=events.find(e=>e.date===date&&e.time===time);return{day,date,time,key,event,owner:claims[key]||null}})),[week,events,claims])
 const visible=slots.filter(s=>(filter==='all'||filter==='meeting'&&s.event||filter==='open'&&s.event&&!s.owner||filter==='none'&&!s.event)&&`${s.day} ${s.time} ${s.owner||''}`.toLowerCase().includes(query.toLowerCase()))
 const claim=key=>setClaims(c=>({...c,[key]:'Dharshni Rangarajan'})),release=key=>setClaims(c=>{const n={...c};delete n[key];return n})
 const manage=()=>{const value=prompt('Enter active CPSR team members, one per line',people.join('\n'));if(value!==null)setPeople(value.split('\n').map(x=>x.trim()).filter(Boolean))}
 const label=`${week.toLocaleDateString('en-AU',{day:'numeric',month:'short'})} – ${addDays(week,6).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`
 return <div className="app-shell"><header className="header"><div className="header-inner"><div className="brand"><div className="brand-icon"><CalendarDays size={21}/></div><div><div className="brand-row"><h1>Live minutes roster</h1><span className="live-pill">LIVE</span></div><p>CPSR · Busy calendar events only · Australia/Sydney</p></div></div><div className="header-actions"><button className="button secondary" onClick={manage}><Settings size={16}/>Manage team</button><button className="button" onClick={fetchWeek}><RefreshCw size={16}/>Sync</button></div></div></header>
 <main className="layout"><section className="content"><div className="week-nav card"><button className="icon-button" onClick={()=>setWeek(addDays(week,-7))}><ChevronLeft/></button><div><strong>{label}</strong><input type="date" value={iso(week)} onChange={e=>setWeek(mondayOf(new Date(`${e.target.value}T12:00:00`)))}/></div><button className="button secondary" onClick={()=>setWeek(mondayOf(new Date()))}>This week</button><button className="icon-button" onClick={()=>setWeek(addDays(week,7))}><ChevronRight/></button></div>
 <div className={`sync-banner ${sync.state}`}><RefreshCw size={18}/><span>{sync.message}</span><small>Use the arrows or date picker to browse any week. Auto-checks every 5 minutes.</small></div>
 <div className="toolbar card"><div className="filters">{[['all','All'],['meeting','Meetings'],['open','Open meetings'],['none','No meeting']].map(([v,l])=><button key={v} className={`filter ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{l}</button>)}</div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search week"/></label></div>
 <div className="days">{days.map(day=><article className="card day-card" key={day}><div className="day-heading"><h2>{day}</h2><span>{addDays(week,dayIndex[day]).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</span></div>{visible.filter(s=>s.day===day).map(s=><div className={`meeting-row ${!s.event?'no-meeting-row':''}`} key={s.key}><div className="meeting-time"><strong>{displayTime(s.time)}</strong><span className="duration">1 hour</span></div><div className="meeting-main">{s.event?<><strong>Busy CPSR meeting</strong><div className="meeting-meta"><span className={`status ${s.owner?'covered':'needs-cover'}`}><i/>{s.owner?'Covered':'Needs cover'}</span>{s.owner&&<span>Minutes: {s.owner}</span>}</div></>:<><strong>⚪ No CPSR meeting at the moment</strong><p className="slot-note">The usual slot remains visible.</p></>}</div><div className="meeting-actions">{s.event&&!s.owner&&<button className="button" onClick={()=>claim(s.key)}><UserRoundCheck size={16}/>Claim</button>}{s.event&&s.owner&&<button className="button ghost" onClick={()=>release(s.key)}>Release</button>}</div></div>)}</article>)}</div></section>
 <aside className="sidebar"><div className="card panel"><div className="panel-title"><Users size={20}/><h3>Minutes team</h3></div><p>Active members</p><div className="team-list">{people.map(name=><div key={name}><span><i/>{name}</span><b>{slots.filter(s=>s.owner===name).length}</b></div>)}</div></div><div className="card panel"><div className="panel-title"><CalendarDays size={20}/><h3>Browse calendar</h3></div><p>Claims are saved against the specific date and time, so each week keeps its own assignments.</p></div></aside></main></div>
}
