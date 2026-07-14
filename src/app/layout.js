import "./globals.css";
import ConnectionBanner from "../components/ConnectionBanner";

export const metadata = {
  title: "Queue System",
  description: "Offline LAN priority queue system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ConnectionBanner />
        {children}
      </body>
    </html>
  );
}
