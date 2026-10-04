'use client';

import {useEffect,useState} from "react";
import {createSupabaseBrowserClient} from "../../lib/supabase/browser";

export default function SurveyPage(){
 const [supabase]=useState(()=>createSupabaseBrowserClient());
 const [surveys,setSurveys]=useState([]),[questions,setQuestions]=useState([]),[surveyId,setSurveyId]=useState(""),[answers,setAnswers]=useState({});
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let mounted=true;(async()=>{const session=await supabase.auth.getSession();if(!mounted)return;setUser(session.data.session?.user||null);const {data,error}=await supabase.from("surveys").select("*").eq("status","published").or("starts_at.is.null,starts_at.lte."+new Date().toISOString()).or("ends_at.is.null,ends_at.gte."+new Date().toISOString()).order("created_at",{ascending:false});if(error)setError(error.message);setSurveys(data||[]);setSurveyId(data?.[0]?.id||"");setLoading(false)})();return()=>{mounted=false}},[]);
 useEffect(()=>{if(!surveyId)return;supabase.from("survey_questions").select("*").eq("survey_id",surveyId).order("sort_order").then(({data,error})=>{if(error)setError(error.message);setQuestions(data||[]);setAnswers({})})},[surveyId]);
 async function submit(e){e.preventDefault();setError("");setMessage("");if(!user){setError("Please sign in before submitting a survey.");return}for(const q of questions){if(q.required&&(answers[q.id]===undefined||answers[q.id]==="")){setError("Please answer all required questions.");return}}setSaving(true);const r=await supabase.from("survey_responses").insert({survey_id:surveyId,user_id:user.id,answers});setSaving(false);if(r.error){setError(r.error.message);return}setMessage("Your response has been submitted. Thank you for supporting local football.");setAnswers({})}
 if(loading)return <main><section className="container page-hero"><span className="section-kicker">ZEDEK SPORTS • Community</span><h1>Surveys</h1><p>Loading active surveys…</p></section></main>;
 return <main><section className="container page-hero"><span className="section-kicker">ZEDEK SPORTS • Community</span><h1>Fan surveys</h1><p>Have your say on the local football ecosystem.</p></section><section className="container" style={{maxWidth:820,paddingBottom:64}}>
 {!user&&<div className="data-note"><strong>Sign in to participate.</strong><span>Survey responses are tied to your Zedek Sports account.</span><a className="button primary" href="/login">Sign in</a></div>}
 {!surveys.length?<div className="empty-state"><strong>No active survey right now.</strong><span>Check back when Zedek Sports opens the next community survey.</span></div>:<form className="panel form-stack" onSubmit={submit}>
 <label>Survey<select value={surveyId} onChange={e=>setSurveyId(e.target.value)}>{surveys.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
 {surveys.find(s=>s.id===surveyId)?.description&&<p className="muted">{surveys.find(s=>s.id===surveyId).description}</p>}
 {questions.map(q=><fieldset key={q.id} style={{border:"0",padding:0,margin:"18px 0"}}><legend style={{fontWeight:700,marginBottom:8}}>{q.prompt}{q.required?" *":""}</legend>
 {q.question_type==="text"&&<textarea rows="4" value={answers[q.id]||""} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}/>}
 {q.question_type==="rating"&&<div style={{display:"flex",gap:10}}>{[1,2,3,4,5].map(n=><label key={n} style={{display:"flex",gap:5,alignItems:"center"}}><input type="radio" name={q.id} checked={String(answers[q.id]||"")===String(n)} onChange={()=>setAnswers({...answers,[q.id]:n})}/>{n}</label>)}</div>}
 {q.question_type==="single"&&<div className="form-stack">{(q.options||[]).map(o=><label key={o} style={{display:"flex",gap:8,alignItems:"center"}}><input type="radio" name={q.id} checked={answers[q.id]===o} onChange={()=>setAnswers({...answers,[q.id]:o})}/>{o}</label>)}</div>}
 {q.question_type==="multi"&&<div className="form-stack">{(q.options||[]).map(o=>{const list=Array.isArray(answers[q.id])?answers[q.id]:[];return <label key={o} style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={list.includes(o)} onChange={e=>setAnswers({...answers,[q.id]:e.target.checked?[...list,o]:list.filter(x=>x!==o)})}/>{o}</label>})}</div>}
 </fieldset>)}
 {error&&<div className="data-note"><strong>Could not submit.</strong><span>{error}</span></div>}{message&&<div className="data-note"><strong>Submitted.</strong><span>{message}</span></div>}
 <button className="button primary" disabled={saving||!user}>{saving?"Submitting…":"Submit survey"}</button>
 </form>}
 </section></main>
}