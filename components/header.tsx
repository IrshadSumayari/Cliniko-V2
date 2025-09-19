'use client';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogIn, User, Menu, X, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface HeaderProps {
  onLogin?: () => void;
  onSignup?: () => void;
}

const Header = ({ onLogin, onSignup }: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="bg-gradient-to-r from-background/95 to-card/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="grid grid-cols-3 items-center">
          {/* Left Section - Navigation */}
          <div className="flex items-center gap-4">
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              <a
                href="#hero"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              >
                Home
              </a>
              <a
                href="#features"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              >
                Features
              </a>
              <a
                href="#security"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              >
                Security
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              >
                FAQ
              </a>
            </nav>
          </div>

          {/* Center Logo */}
          <div className="flex items-center justify-center">
            <img
              src="/assets/logos/0ed091e5-2cfd-4e42-9b90-641896ead380.png"
              alt="MyPhysioFlow Logo"
              className="h-10 md:h-12 w-auto max-w-[200px] md:max-w-[240px]"
            />
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center  justify-end gap-3">
            {/* Support Link */}
            {/* <a
              href="#support"
              className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
            >
              <HelpCircle className="h-4 w-4" />
              Support
            </a> */}

            {/* Theme Toggle */}
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden sm:flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In
                </Link>
              </Button>
              <Button
                variant="default"
                size="sm"
                asChild
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 shadow-sm"
              >
                <Link href="/signup">
                  <User className="h-4 w-4 mr-2" />
                  Sign Up
                </Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-muted/50 w-9 h-9 p-0"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-border/50 pt-4">
            <div className="flex flex-col space-y-2">
              {/* Mobile Navigation */}
              <nav className="flex flex-col space-y-1">
                <a
                  href="#hero"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </a>
                <a
                  href="#features"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#security"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Security
                </a>
                <a
                  href="#pricing"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  FAQ
                </a>
                {/* <a
                  href="#support"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Support
                </a> */}
              </nav>

              {/* Mobile Theme Toggle & Auth Buttons */}
              <div className="flex flex-col space-y-2 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In
                  </Link>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="justify-start bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                >
                  <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                    <User className="h-4 w-4 mr-2" />
                    Sign Up
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
