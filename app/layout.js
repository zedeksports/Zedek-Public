import "./globals.css";
import "./home-premium.css";
import PublicShell from "./PublicShell";
import AnalyticsTracker from "./AnalyticsTracker";

export const metadata = {
  title: "ZEDEK SPORTS",
  description: "The home of local football in Ghana and Oti."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><AnalyticsTracker /><PublicShell>{children}</PublicShell></body>
    </html>
  );
}
