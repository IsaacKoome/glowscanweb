// app/layout.tsx
import Link from 'next/link';
import './globals.css';
import { AuthProvider, useAuth } from '../context/AuthContext'; // Import AuthProvider and useAuth
import { useEffect } from 'react'; // Import useEffect for client-side rendering of AuthButton

export const metadata = {
  title: 'WonderJoy AI',
  description: 'AI-powered skin analysis and beauty assistant'
};

// Client component for the AuthButton to use useAuth hook
function AuthButton() {
  const { user, loading, logout } = useAuth(); // Use the auth context

  // Avoid rendering anything until auth state is loaded to prevent flickering
  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <div className="flex space-x-4 items-center"> {/* Added flex and items-center for alignment */}
      {user ? (
        <>
          {/* Optional: Display user's email or a link to profile */}
          {user.email && <span className="text-white text-lg font-semibold hidden md:inline">{user.email}</span>}
          <Link href={`/profile/${user.uid}`} className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">
            Profile
          </Link>
          <button
            onClick={logout}
            className="bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 transition shadow-md"
          >
            Logout 👋
          </button>
        </>
      ) : (
        <Link href="/login" passHref>
          <button className="bg-white text-purple-600 py-2 px-4 rounded-full text-base font-semibold hover:bg-gray-100 transition shadow-md">
            Login / Register 🔑
          </button>
        </Link>
      )}
    </div>
  );
}

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
              <nav className="flex space-x-6 items-center"> {/* Added items-center for vertical alignment */}
                <Link href="/" 
                className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Home
                </Link>
                <Link href="/upload" 
                className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Upload
                </Link>
                {/* Profile link is now handled by AuthButton for dynamic UID */}
                <Link href="/tips"
                  className="text-white text-lg font-semibold hover:text-pink-200 transition-colors">Tips
                </Link>
                <AuthButton /> {/* Render the AuthButton here */}
              </nav>
            </div>
          </header>
          <main className="min-h-screen">
            {children}
          </main>
          <footer className="bg-gray-800 text-white p-6 text-center text-sm">
            <div className="max-w-7xl mx-auto">
              © {new Date().getFullYear()} WonderJoy AI. All rights reserved. {/* Updated name here */}
              <p className="mt-2 text-gray-400">Innovating beauty with intelligence. 🌟</p>
            </div>
          </footer>
        </AuthProvider> {/* Close AuthProvider */}
      </body>
    </html>
  );
}