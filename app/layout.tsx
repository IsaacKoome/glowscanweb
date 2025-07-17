// app/layout.tsx
import './globals.css';
import Link from 'next/link';
import { AuthProvider } from '../context/AuthContext';
import HeaderNavClient from '@/components/HeaderNavClient';
import Script from 'next/script'; // ✅ import Script from next/script

export const metadata = {
  title: 'WonderJoy AI ✨',
  description: 'AI-powered skin analysis and beauty assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Place analytics script here */}
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-CJQ39X0H3R" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CJQ39X0H3R');
          `}
        </Script>
      </head>
      <body className="bg-white text-gray-900 font-sans antialiased">
        <AuthProvider>
          <header className="bg-gradient-to-r from-pink-500 to-purple-600 shadow-lg p-4">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-4">
              <Link
                href="/"
                className="text-3xl font-extrabold text-white mb-2 sm:mb-0 hover:opacity-90 transition-opacity"
              >
                WonderJoy AI ✨
              </Link>
              <HeaderNavClient />
            </div>
          </header>

          <main className="min-h-screen">{children}</main>

          <footer className="bg-gray-800 text-white p-6 text-center text-sm">
            <div className="max-w-7xl mx-auto">
              © {new Date().getFullYear()} WonderJoy AI. All rights reserved.
              <p className="mt-2 text-gray-400">Innovating beauty with intelligence. 🌟</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
