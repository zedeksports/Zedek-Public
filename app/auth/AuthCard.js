'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export function AuthCard({ mode }) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function submit(e){
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    try{
      if(mode==="login"){
        const {error}=await createSupabaseBrowserClient().auth.signInWithPassword({email,password});
        if(error) throw error;
        window.location.href="/";
      }else if(mode==="signup"){
        const {data,error}=await createSupabaseBrowserClient().auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:window.location.origin+"/"}});
        if(error) throw error;
        if(data.session) window.location.href="/";
        else setMessage("Account created. Check your email if email confirmation is required, then sign in.");
      }else{
        const {error}=await createSupabaseBrowserClient().auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/reset-password"});
        if(error) throw error;
        setMessage("If that email is registered, a password reset link has been sent.");
      }
    }catch(err){setError(err?.message||"Something went wrong.");}
    finally{setLoading(false);}
  }

  const title=mode==="login"?"Welcome back":mode==="signup"?"Create your Zedek account":"Reset your password";
  const subtitle=mode==="login"?"Follow your football, your way.":mode==="signup"?"Save favourites, alerts and settings across devices.":"Enter your email and we'll send you a secure reset link.";

  return <main className="account-page page">
    <div className="container account-grid">
      <section className="account-intro">
        <span className="section-kicker">ZEDEK SPORTS ACCOUNT</span>
        <h1>{title}</h1><p>{subtitle}</p>
        <div className="account-benefits"><div><b>★</b><span>Sync favourite teams and matches</span></div><div><b>◉</b><span>Personalise football notifications</span></div><div><b>⚙</b><span>Control theme, time zone and match preferences</span></div></div>
      </section>
      <section className="account-card">
        <form onSubmit={submit}>
          {mode==="signup"?<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" /></label>:null}
          <label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></label>
          {mode!=="forgot"?<label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="login"?"current-password":"new-password"} /></label>:null}
          {error?<div className="account-error">{error}</div>:null}
          {message?<div className="account-message">{message}</div>:null}
          <button className="button primary account-submit" disabled={loading}>{loading?"Please wait…":mode==="login"?"Sign in":mode==="signup"?"Create account":"Send reset link"}</button>
        </form>
        <div className="account-links">
          {mode==="login"?<><a href="/forgot-password">Forgot password?</a><a href="/signup">Create account</a></>:mode==="signup"?<a href="/login">Already have an account? Sign in</a>:<a href="/login">Back to sign in</a>}
        </div>
      </section>
    </div>
  </main>;
}

export function RequireSession({ children }) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const supabase=createSupabaseBrowserClient();
    supabase.auth.getSession().then(({data})=>{if(!data.session) window.location.href="/login"; else setReady(true);});
  },[]);
  return ready?children:<main className="account-page page"><div className="container empty-state">Checking your account…</div></main>;
}