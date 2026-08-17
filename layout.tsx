import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
export const metadata:Metadata={title:"Mixtape — Say it with songs",description:"Make a mixtape that feels like a gift."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}<Toaster position="bottom-center" toastOptions={{className:"toast"}}/></body></html>}
