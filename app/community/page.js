import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_posts")
    .select("id,title,slug,excerpt,cover_image_url,category,featured,published_at,author:profiles!content_posts_author_id_fkey(full_name)")
    .eq("content_type","community_update")
    .eq("status","published")
    .lte("published_at", new Date().toISOString())
    .order("featured",{ascending:false})
    .order("published_at",{ascending:false})
    .limit(30);

  const posts = data || [];
  return <main>
    <section className="container page-hero news-hero">
      <span className="section-kicker">Zedek Sports • Community</span>
      <h1>Community updates.</h1>
      <p>Local football announcements, grassroots stories, team-community updates and verified happenings across Oti.</p>
    </section>
    <section className="container news-page">
      {error ? <div className="data-note">{error.message}</div> : posts.length ? (
        <div className="news-grid">
          {posts.map((post) => (
            <a className={post.featured ? "news-card news-card-featured" : "news-card"} href={"/community/"+post.slug} key={post.id}>
              <div className="news-cover">{post.cover_image_url ? <img src={post.cover_image_url} alt="" loading={post.featured ? "eager" : "lazy"} /> : <span>ZEDEK<br/>COMMUNITY</span>}</div>
              <div className="news-card-body">
                <span className="section-kicker">{post.category || "Community"}</span>
                <h2>{post.title}</h2>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
                <div className="news-meta"><span>{post.author?.full_name || "Zedek Sports"}</span><span>{post.published_at ? new Intl.DateTimeFormat("en-GH",{day:"numeric",month:"short",year:"numeric"}).format(new Date(post.published_at)) : ""}</span></div>
              </div>
            </a>
          ))}
        </div>
      ) : <div className="empty-state news-empty"><strong>No community updates yet.</strong><span>Published grassroots updates will appear here automatically from the Control Room.</span></div>}
    </section>
  </main>;
}
