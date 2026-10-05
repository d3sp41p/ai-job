import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./globals.css";
import { EmployeeProvider } from "@/lib/wallet";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PayTicker from "@/components/PayTicker";
import { TOKEN_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: TOKEN_NAME,
  description: "AI took your job. Now it's hiring. Hold the coin, take assignments, get paid in SOL.",
};

const TRANSLATE_GUARD = `(function(){if(typeof Node!=="function"||!Node.prototype)return;var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c.parentNode!==this){return c}return r.apply(this,arguments)};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this){return n}return i.apply(this,arguments)}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Browser auto-translate (Chrome, Edge) swaps text nodes for its own <font> tags.
            React then fails to update or remove them and the page crashes.
            This makes those DOM calls tolerant, so translated pages keep working. */}
        <script dangerouslySetInnerHTML={{ __html: TRANSLATE_GUARD }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <EmployeeProvider>
          <PayTicker />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </EmployeeProvider>
      </body>
    </html>
  );
}
