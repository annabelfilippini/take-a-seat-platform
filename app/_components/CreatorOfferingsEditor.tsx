'use client';
import type { Offering } from '../_lib/offerings';
export function CreatorOfferingsEditor({ offerings, onChange }: { offerings: Offering[]; onChange: (items: Offering[]) => void }) {
  function update(id: string, change: Partial<Offering>) { onChange(offerings.map((item) => item.id === id ? {...item,...change} : item)); }
  function move(index: number, direction: number) { const next = [...offerings]; [next[index],next[index+direction]]=[next[index+direction],next[index]]; onChange(next); }
  return <div className="creator-offerings">
    {offerings.map((item,index) => <fieldset className="creator-offering-card" key={item.id}><legend>Offering {index+1}</legend>
      <label>Title<input aria-label={`Offering ${index+1} title`} maxLength={80} value={item.title} onChange={(event) => update(item.id,{title:event.target.value})} /></label>
      <div className="creator-offering-numbers"><label>Minutes<select aria-label={`Offering ${index+1} duration`} value={item.durationMinutes} onChange={(event) => update(item.id,{durationMinutes:Number(event.target.value)})}>{Array.from({length:12},(_,i)=>(i+1)*15).map((minutes)=><option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>
      <label>Price<input aria-label={`Offering ${index+1} price`} type="number" min="0" max="10000" step="0.01" value={item.unitAmount/100} onChange={(event) => update(item.id,{unitAmount:Math.round(Number(event.target.value)*100)})} /></label></div>
      <label>Description<textarea aria-label={`Offering ${index+1} description`} rows={3} maxLength={300} value={item.description} onChange={(event) => update(item.id,{description:event.target.value})} /></label>
      <label><input type="checkbox" checked={item.active && !item.archived} onChange={(event) => update(item.id,{active:event.target.checked,archived:false})} />Active</label>
      <div className="creator-request-actions"><button type="button" aria-label={`Move offering ${index+1} up`} disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button type="button" aria-label={`Move offering ${index+1} down`} disabled={index===offerings.length-1} onClick={()=>move(index,1)}>↓</button></div>
    </fieldset>)}
    <button type="button" className="editable-secondary-button" disabled={offerings.length>=12} onClick={()=>onChange([...offerings,{id:`offer_${crypto.randomUUID()}`,title:'',durationMinutes:15,unitAmount:0,description:'',active:false}])}>Add offering</button>
  </div>;
}
