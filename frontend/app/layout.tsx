import "./globals.css";

import AppNavbar from "@/components/navigation/AppNavbar";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}
