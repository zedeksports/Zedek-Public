import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewsArticlePage({ params }) {
  const { slug } = await params;
  const supabase = createSupabaseServerClient();
  const { data: post, error } = await supabase
    .from("content_posts")
    .select("id,title,slug,excerpt,body,cover_image_url,category,featured,published_at")
    .eq("slug", slug)
    .eq("status","published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error || !post) notFound();
  return <main>
    <article className="container news-article">
      <a className="public-breadcrumbs" href="/news">← Football news</a>
      <header className="news-article-head">
        <span className="section-kicker">{post.category || "Football"}</span>
        <h1>{post.title}</h1>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
        <div className="news-meta"><span>{"Zedek Sports"}</span><span>{post.published_at ? new Intl.DateTimeFormat("en-GH",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(post.published_at)) : ""}</span></div>
      </header>
      {post.cover_image_url ? <div className="news-article-cover"><img src={post.cover_image_url} alt="" fetchPriority="high" decoding="async" /></div> : null}
      <div className="news-body">{String(post.body || "").split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
    </article>
  </main>;
}