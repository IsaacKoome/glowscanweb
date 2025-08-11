// app/layout.tsx
import './globals.css';
import Link from 'next/link';
import { AuthProvider } from '../context/AuthContext';
import { CameraProvider } from '../context/CameraContext';
import HeaderNavClient from '@/components/HeaderNavClient';
import CameraModal from '@/components/CameraModal';
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
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1335773994240018"
          crossOrigin="anonymous"></script>
      </head>
      <body className="bg-white text-gray-900 font-sans antialiased">
        <AuthProvider>
          <CameraProvider>
            <header className="bg-gradient-to-r from-pink-500 to-purple-600 shadow-lg p-4 fixed w-full z-10 top-0"> {/* Added fixed positioning and z-index */}
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-4 relative"> {/* Added relative for mobile menu positioning */}
                <Link
                  href="/"
                  className="text-3xl font-extrabold text-white mb-2 sm:mb-0 hover:opacity-90 transition-opacity"
                >
                  WonderJoy AI ✨
                </Link>
                <HeaderNavClient /> {/* This component now handles all primary navigation */}
              </div>
            </header>

            <main className="min-h-screen pt-20"> {/* Added padding-top to account for fixed header */}
              {children}
            </main>

            <CameraModal />

            <footer className="bg-gray-800 text-white p-6 text-center text-sm">
              <div className="max-w-7xl mx-auto">
                © {new Date().getFullYear()} WonderJoy AI. All rights reserved.
                <p className="mt-2 text-gray-400">Innovating beauty with intelligence. 🌟</p>
              </div>
            </footer>
          </CameraProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
