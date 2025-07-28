// components/HeaderNavClient.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, MenuIcon, XIcon, UserIcon, LogOutIcon, DollarSign, Lightbulb } from 'lucide-react'; // Added icons

// Assuming you have Shadcn UI components setup, otherwise adjust imports
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from 'next/image';

export default function HeaderNavClient() {
  const { user, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNewAnalysisClick = () => {
    // This will simply navigate to the chat page, where the sidebar
    // will handle creating a new chat session if no ID is provided in URL.
    // Or, if you want to explicitly start a new chat, you might add a
    // query param like /chat?new=true and handle it in AiChatPage.
    // For now, simple navigation is fine as the chat page handles 'no history'.
    if (isMobileMenuOpen) setIsMobileMenuOpen(false); // Close menu on click
  };

  return (
    <nav className="flex items-center space-x-4">
      {/* Desktop Navigation */}
      <div className="hidden sm:flex items-center space-x-4">
        {/* New Analysis Button - now simpler and always visible */}
        <Link href="/chat" passHref>
          <Button
            className="bg-white text-purple-600 hover:bg-purple-100 px-6 py-2 rounded-full font-semibold shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
            onClick={handleNewAnalysisClick}
          >
            New Analysis
          </Button>
        </Link>
        {/* Billing */}
        <Link href="/billing" passHref>
          <Button variant="ghost" className="text-white hover:text-purple-100 px-4 py-2 rounded-md font-medium">
            <DollarSign className="w-5 h-5 mr-2" /> Billing
          </Button>
        </Link>
        {/* Tips */}
        <Link href="/tips" passHref>
          <Button variant="ghost" className="text-white hover:text-purple-100 px-4 py-2 rounded-md font-medium">
            <Lightbulb className="w-5 h-5 mr-2" /> Tips
          </Button>
        </Link>

        {/* User Authentication Status */}
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-white ml-4" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || user.email || 'User'}
                    width={40}
                    height={40}
                    className="rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold text-lg border-2 border-white">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal flex flex-col">
                <span className="font-semibold text-lg">{user.displayName || 'Anonymous User'}</span>
                {user.email && <span className="text-xs text-gray-500">{user.email}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOutIcon className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
              {/* Profile link remains here if you want a detailed profile page accessible */}
              <DropdownMenuItem>
                <Link href="/profile" className="flex items-center w-full h-full">
                  <UserIcon className="mr-2 h-4 w-4" /> Profile Details
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login" passHref>
            <Button className="bg-white text-purple-600 hover:bg-purple-100 px-6 py-2 rounded-full font-semibold shadow-md transition-all duration-300 ease-in-out transform hover:scale-105">
              Login
            </Button>
          </Link>
        )}
      </div>

      {/* Mobile Menu Toggle */}
      <div className="sm:hidden flex items-center">
        <Button
          onClick={toggleMobileMenu}
          variant="ghost"
          className="text-white hover:bg-purple-700 p-2"
          aria-label="Toggle mobile menu"
        >
          {isMobileMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu Content */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="absolute top-16 right-4 bg-white p-4 rounded-lg shadow-xl flex flex-col space-y-3 sm:hidden z-20"
        >
          <Link href="/chat" passHref>
            <Button
              className="w-full justify-start text-purple-600 hover:bg-purple-100"
              onClick={handleNewAnalysisClick}
            >
              New Analysis
            </Button>
          </Link>
          <Link href="/billing" passHref>
            <Button variant="ghost" className="w-full justify-start text-gray-800 hover:bg-gray-100">
              <DollarSign className="w-5 h-5 mr-2" /> Billing
            </Button>
          </Link>
          <Link href="/tips" passHref>
            <Button variant="ghost" className="w-full justify-start text-gray-800 hover:bg-gray-100">
              <Lightbulb className="w-5 h-5 mr-2" /> Tips
            </Button>
          </Link>

          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          ) : user ? (
            <>
              <Link href="/profile" passHref>
                 <Button variant="ghost" className="w-full justify-start text-gray-800 hover:bg-gray-100">
                  <UserIcon className="mr-2 h-5 w-5" /> Profile Details
                </Button>
              </Link>
              <Button
                onClick={logout}
                variant="ghost"
                className="w-full justify-start text-red-600 hover:bg-red-50"
              >
                <LogOutIcon className="mr-2 h-5 w-5" /> Log out
              </Button>
            </>
          ) : (
            <Link href="/login" passHref>
              <Button className="w-full justify-start bg-purple-600 text-white hover:bg-purple-700">
                Login
              </Button>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}