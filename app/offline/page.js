export default function OfflinePage() {
  return (
    <main className="container section">
      <section className="dashboard-card" style={{maxWidth:720,margin:"48px auto",textAlign:"center"}}>
        <span className="section-kicker">ZEDEK SPORTS</span>
        <h1>You’re offline</h1>
        <p>Reconnect to the internet and try again. Your installed ZEDEK SPORTS app will return to the live football experience when the connection is restored.</p>
        <a className="button" href="/">Try again</a>
      </section>
    </main>
  );
}
