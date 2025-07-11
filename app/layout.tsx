// app/layout.tsx
import Link from 'next/link';
import './globals.css';
import { AuthProvider } from '../context/AuthContext'; // Only import AuthProvider
import HeaderNavClient from '@/components/HeaderNavClient'; // Import the new client component

export const metadata = {
  title: 'WonderJoy AI',
  description: 'AI-powered skin analysis and beauty assistant'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 font-sans antialiased">
        <AuthProvider> {/* Wrap the entire application with AuthProvider */}
          <header className="bg-gradient-to-r from-pink-500 to-purple-600 shadow-lg p-4">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-4">
              <Link href="/" className="text-3xl font-extrabold text-white mb-2 sm:mb-0 hover:opacity-90 transition-opacity">
                WonderJoy AI ✨
              </Link>
              {/* Render the client component for navigation and auth button */}
              <HeaderNavClient /> 
            </div>
          </header>
          <main className="min-h-screen">
            {children}
          </main>
        
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