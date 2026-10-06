import "./globals.css";
import "./home-premium.css";
import PublicShell from "./PublicShell";
import SiteAnalyticsTracker from "./SiteAnalyticsTracker";

export const metadata = {
  title: "ZEDEK SPORTS",
  description: "The home of local football in Ghana and Oti."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteAnalyticsTracker />
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
