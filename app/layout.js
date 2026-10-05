import "./globals.css";
import "./home-premium.css";
import PublicShell from "./PublicShell";

export const metadata = {
  title: "ZEDEK SPORTS",
  description: "The home of local football in Ghana and Oti."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><PublicShell>{children}</PublicShell></body>
    </html>
  );
}
