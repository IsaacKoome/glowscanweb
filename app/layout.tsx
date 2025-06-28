// app/layout.jsx

// Import Link for client-side navigation
import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'Glowscan AI',
  description: 'AI-powered skin analysis and beauty assistant',
};

export default function RootLayout({ children}: {children: React.ReactNode})  {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 font-sans antialiased"> {/* Added antialiased for smoother fonts */}
        <header className="bg-gradient-to-r from-pink-500 to-purple-600 shadow-lg p-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-4">
            <Link href="/" className="text-3xl font-extrabold text-white mb-2 sm:mb-0 hover:opacity-90 transition-opacity">
                Glowscan AI ✨
            </Link>
            <nav className="flex space-x-6">
              <Link href="/" 
              className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Home
              </Link>
              <Link href="/upload" 
              className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Upload
              </Link>
              <Link href="/profile" 
                className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Profile
              </Link>
              <Link href="/tips"
                className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Tips
              </Link>
            </nav>
          </div>
        </header>
        <main className="min-h-screen">
          {children} {/* This is where your individual pages (index.tsx, upload/page.jsx, etc.) will be rendered */}
        </main>
        <footer className="bg-gray-800 text-white p-6 text-center text-sm">
          <div className="max-w-7xl mx-auto">
            © {new Date().getFullYear()} Glowscan AI. All rights reserved.
            <p className="mt-2 text-gray-400">Innovating beauty with intelligence. 🌟</p>
          </div>
        </footer>
      </body>
    </html>
  );
}