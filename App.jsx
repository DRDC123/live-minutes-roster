import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CircleAlert, Clock3, ExternalLink, Pencil, Plus, RefreshCw, Save, Search, Settings, Trash2, UserRoundCheck, Users, X } from 'lucide-react'

const SOURCE_URL = 'https://outlook.office365.com/calendar/published/675621241b7c4d238852dc4508f6764c@dxc.com/df97f590c5e24b0bba39b8fed1b84d702306156400361748759/calendar.html'
const STORAGE_KEY = 'cpsr-live-minutes-v2'
const defaultPeople = ['Jennifer Cabading','Maisie Chandler','Samantha Gallen','Acille Kabbara','Dharshni Rangarajan','Chester Viernes','Curtis Wise-Lancaster'].map((name, i) => ({ id: `p${i+1}`, name, active: true }))
const weeklySlots = [
  ['Tuesday','13:00'],['Tuesday','14:00'],
  ['Wednesday','09:00'],['Wednesday','10:00'],['Wednesday','11:00'],
  ['Thursday','09:00'],['Thursday','10:00'],['Thursday','11:00'],
  ['Friday','13:00'],['Friday','14:00'],
].map(([day,time],i) => ({ id:`slot-${i+1}`, day, time, duration:60 }))

function weekDates(base = new Date()) {
  const current = new Date(base)
  const day = current.getDay() || 7
  const monday = new Date(current)
  monday.setHours(0,0,0,0)
  monday.setDate(current.getDate() - day + 1)
  return Object.fromEntries(['Monday','Tuesday','Wednesday','Thursday','Friday'].map((name,i) => { const d = new Date(monday); d.setDate(monday.getDate()+i); return [name,d] }))
}
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function displayTime(value){ const [h,m]=value.split(':').map(Number); return new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit'}).format(new Date(2026,0,1,h,m)) }
function blankAssignments(){ return Object.fromEntries(weeklySlots.map(s => [s.id,{ ownerId:null,status:'needs-cover',reconfirm:false }])) }
function loadState(){ try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)); return saved || null } catch { return null } }

export default function App(){
  const initial=loadState()
  const [people,setPeople]=useState(initial?.people || defaultPeople)
  const [slots,setSlots]=useState(initial?.slots || weeklySlots)
  const [assignments,setAssignments]=useState(initial?.assignments || blankAssignments())
  const [manualMeetings,setManualMeetings]=useState(initial?.manualMeetings || {})
  const [calendarEvents,setCalendarEvents]=useState([])
  const [sync,setSync]=useState({state:'idle',at:null,message:'Not checked yet'})
  const [view,setView]=useState('roster')
  const [filter,setFilter]=useState('all')
  const [query,setQuery]=useState('')
  const [newPerson,setNewPerson]=useState('')
  const dates=useMemo(()=>weekDates(),[])

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY,JSON.stringify({people,slots,assignments,manualMeetings})) },[people,slots,assignments,manualMeetings])

  const syncCalendar=async()=>{
    setSync(s=>({...s,state:'loading',message:'Checking published calendar…'}))
    try{
      const result=await fetch('/api/calendar').then(r=>r.json())
      if(!result.ok) throw new Error(result.error||'Calendar sync failed')
      setCalendarEvents(result.events||[])
      setSync({state:'ok',at:new Date(result.fetchedAt),message:`Calendar checked · ${result.events.length} busy event${result.events.length===1?'':'s'} found`})
    }catch(error){ setSync({state:'error',at:new Date(),message:`Calendar unavailable: ${error.message}`}) }
  }
  useEffect(()=>{ syncCalendar(); const timer=setInterval(syncCalendar,300000); return()=>clearInterval(timer) },[])

  const rows=slots.map(slot=>{
    const date=isoDate(dates[slot.day])
    const autoMeeting=calendarEvents.some(e=>e.date===date && e.time===slot.time)
    const manual=manualMeetings[slot.id]
    const hasMeeting=manual?.mode==='meeting' || (manual?.mode!=='none' && autoMeeting)
    const assignment=assignments[slot.id] || {ownerId:null,status:'needs-cover',reconfirm:false}
    const owner=people.find(p=>p.id===assignment.ownerId)
    return {...slot,date,hasMeeting,title:manual?.title||'CPSR Meeting',assignment,owner}
  })
  const activePeople=people.filter(p=>p.active)
  const counts={ meetings:rows.filter(r=>r.hasMeeting).length, uncovered:rows.filter(r=>r.hasMeeting&&!r.owner).length, covered:rows.filter(r=>r.hasMeeting&&r.owner&&!r.assignment.reconfirm).length, reconfirm:rows.filter(r=>r.hasMeeting&&r.assignment.reconfirm).length }
  const teamStats=activePeople.map(p=>({ ...p, assigned:rows.filter(r=>r.hasMeeting&&r.owner?.id===p.id).length }))
  const filtered=rows.filter(r=>(filter==='all'||(filter==='meeting'&&r.hasMeeting)||(filter==='none'&&!r.hasMeeting)||(filter==='needs-cover'&&r.hasMeeting&&!r.owner)) && `${r.day} ${r.time} ${r.title} ${r.owner?.name||''}`.toLowerCase().includes(query.toLowerCase()))
  const updateAssignment=(id,patch)=>setAssignments(a=>({...a,[id]:{...(a[id]||{}),...patch}}))
  const claim=id=>updateAssignment(id,{ownerId:people.find(p=>p.name==='Dharshni Rangarajan')?.id||activePeople[0]?.id,status:'covered',reconfirm:false})
  const release=id=>updateAssignment(id,{ownerId:null,status:'needs-cover',reconfirm:false})

  const addPerson=()=>{ const name=newPerson.trim(); if(!name)return; setPeople(p=>[...p,{id:`p-${Date.now()}`,name,active:true}]); setNewPerson('') }
  const removePerson=id=>{ setPeople(p=>p.map(person=>person.id===id?{...person,active:false}:person)); setAssignments(a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v.ownerId===id?{...v,ownerId:null,status:'needs-cover'}:v]))) }
  const editPerson=id=>{ const current=people.find(p=>p.id===id); const name=window.prompt('Edit team member name',current?.name||'')?.trim(); if(name)setPeople(p=>p.map(x=>x.id===id?{...x,name}:x)) }
  const editMeeting=slot=>{ const title=window.prompt('Meeting title',manualMeetings[slot.id]?.title||'CPSR Meeting'); if(title!==null)setManualMeetings(m=>({...m,[slot.id]:{mode:'meeting',title:title.trim()||'CPSR Meeting'}})) }
  const markNoMeeting=id=>{ setManualMeetings(m=>({...m,[id]:{mode:'none',title:''}})); release(id) }
  const useCalendar=id=>setManualMeetings(m=>{ const next={...m}; delete next[id]; return next })

  return <div className="app-shell">
    <header className="header"><div className="header-inner"><div className="brand"><div className="brand-icon"><CalendarDays size={21}/></div><div><div className="brand-row"><h1>Live minutes roster</h1><span className="live-pill">LIVE</span></div><p>CPSR · Busy calendar events only · AEDT</p></div></div><div className="header-actions"><button className="button secondary" onClick={()=>setView(view==='roster'?'manage':'roster')}>{view==='roster'?<><Settings size={16}/>Manage roster</>:<><CalendarDays size={16}/>Back to roster</>}</button><button className="button" onClick={syncCalendar}><RefreshCw size={16}/>Sync now</button></div></div></header>

    {view==='manage'?<main className="manage-layout">
      <section className="card manage-card"><div className="section-title"><Users size={20}/><div><h2>Manage CPSR team</h2><p>Add, rename or deactivate people. Removing a person releases their allocated meetings.</p></div></div><div className="add-row"><input value={newPerson} onChange={e=>setNewPerson(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPerson()} placeholder="New team member name"/><button className="button" onClick={addPerson}><Plus size={16}/>Add person</button></div><div className="manage-list">{activePeople.map(person=><div key={person.id}><span>{person.name}</span><div><button className="icon-button" onClick={()=>editPerson(person.id)} title="Edit"><Pencil size={16}/></button><button className="icon-button danger" onClick={()=>removePerson(person.id)} title="Deactivate"><Trash2 size={16}/></button></div></div>)}</div></section>
      <section className="card manage-card"><div className="section-title"><Clock3 size={20}/><div><h2>Manage meeting slots</h2><p>Calendar sync remains the default. Manual changes override the published calendar until “Use calendar” is selected.</p></div></div><div className="manage-list">{rows.map(row=><div key={row.id} className="slot-manage"><span><strong>{row.day} · {displayTime(row.time)}</strong><small>{row.hasMeeting?row.title:'No meeting'} · 1 hour</small></span><div><button className="mini-button" onClick={()=>editMeeting(row)}>Edit / add</button><button className="mini-button" onClick={()=>markNoMeeting(row.id)}>No meeting</button><button className="mini-button" onClick={()=>useCalendar(row.id)}>Use calendar</button></div></div>)}</div></section>
    </main>:<main className="layout"><section className="content">
      <div className="summary-grid">{[['Meetings',counts.meetings,'neutral'],['Needs cover',counts.uncovered,'red'],['Reconfirm',counts.reconfirm,'amber'],['Covered',counts.covered,'green']].map(([l,v,c])=><div className="card summary" key={l}><span>{l}</span><strong className={c}>{v}</strong></div>)}</div>
      <div className={`sync-banner ${sync.state}`}><RefreshCw size={18}/><span>{sync.message}</span><small>Auto-checks every 5 minutes. Tentative events are ignored.</small></div>
      <div className="toolbar card"><div className="filters">{[['all','All'],['meeting','Meetings'],['needs-cover','Needs cover'],['none','No meeting']].map(([v,l])=><button key={v} className={`filter ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{l}</button>)}</div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search meetings or owners"/></label></div>
      <div className="days">{['Tuesday','Wednesday','Thursday','Friday'].map(day=><article className="card day-card" key={day}><div className="day-heading"><h2>{day}</h2><span>{dates[day].toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</span></div>{filtered.filter(r=>r.day===day).map(row=><div className={`meeting-row ${!row.hasMeeting?'no-meeting-row':''}`} key={row.id}><div className="meeting-time"><strong>{displayTime(row.time)}</strong><span className="duration">1 hour</span></div><div className="meeting-main">{row.hasMeeting?<><strong>{row.title}</strong><div className="meeting-meta"><span className={`status ${row.owner?'covered':'needs-cover'}`}><i/>{row.owner?'Covered':'Needs cover'}</span>{row.owner&&<span>Minutes: {row.owner.name}</span>}</div></>:<><strong>⚪ No CPSR meeting at the moment</strong><p className="slot-note">This usual CPSR slot remains visible.</p></>}</div><div className="meeting-actions">{row.hasMeeting&&!row.owner&&<button className="button" onClick={()=>claim(row.id)}><UserRoundCheck size={16}/>Claim</button>}{row.hasMeeting&&row.owner&&<button className="button ghost" onClick={()=>release(row.id)}>Release</button>}</div></div>)}</article>)}</div>
    </section><aside className="sidebar"><div className="card panel"><div className="panel-title"><Users size={20}/><h3>Minutes team</h3></div><p>Active members · assignments this week</p><div className="team-list">{teamStats.map(p=><div key={p.id}><span><i/>{p.name}</span><b>{p.assigned}</b></div>)}</div></div><div className="card panel"><div className="panel-title"><ExternalLink size={20}/><h3>Calendar source</h3></div><p>Published Outlook calendar</p><a href={SOURCE_URL} target="_blank" rel="noreferrer">Open calendar <ExternalLink size={14}/></a><div className="source-info"><div><span>Busy only</span><strong>Yes</strong></div><div><span>Tentative</span><strong>Ignored</strong></div><div><span>Last checked</span><strong>{sync.at?sync.at.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}):'Not yet'}</strong></div></div></div></aside></main>}
  </div>
}
