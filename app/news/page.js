import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_posts")
    .select("id,title,slug,excerpt,cover_image_url,category,featured,published_at")
    .eq("content_type","news")
    .eq("status","published")
    .lte("published_at", new Date().toISOString())
    .order("featured",{ascending:false})
    .order("published_at",{ascending:false})
    .limit(30);

  const posts = data || [];
  return <main>
    <section className="container page-hero news-hero">
      <span className="section-kicker">Zedek Sports • Community</span>
      <h1>Football news.</h1>
      <p>Reports, team updates, player stories, competition news and community football from across Oti.</p>
    </section>
    <section className="container news-page">
      {error ? <div className="data-note">{error.message}</div> : posts.length ? (
        <div className="news-grid">
          {posts.map((post) => (
            <a className={post.featured ? "news-card news-card-featured" : "news-card"} href={"/news/"+post.slug} key={post.id}>
              <div className="news-cover">{post.cover_image_url ? <img src={post.cover_image_url} alt="" loading={post.featured ? "eager" : "lazy"} /> : <span>ZEDEK<br/>SPORTS</span>}</div>
              <div className="news-card-body">
                <span className="section-kicker">{post.category || "Football"}</span>
                <h2>{post.title}</h2>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
                <div className="news-meta"><span>{"Zedek Sports"}</span><span>{post.published_at ? new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(post.published_at)) : ""}</span></div>
              </div>
            </a>
          ))}
        </div>
      ) : <div className="empty-state news-empty"><strong>No published stories yet.</strong><span>New Zedek Sports reports will appear here as soon as the Newsroom publishes them.</span></div>}
    </section>
  </main>;
}