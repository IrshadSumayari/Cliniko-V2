"use client"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"

interface HeaderProps {
  onLogin?: () => void
  onSignup?: () => void
}

const Header = ({ onLogin, onSignup }: HeaderProps) => {
  return (
    <header className="px-4 lg:px-6 h-14 flex items-center border-b">
      <a className="flex items-center justify-center" href="#">
        <span className="text-xl font-semibold">MyPhysioFlow</span>
      </a>
      <nav className="ml-auto flex items-center gap-4 sm:gap-6">
        <a className="text-sm font-medium hover:underline underline-offset-4" href="#features">
          Features
        </a>
        <a className="text-sm font-medium hover:underline underline-offset-4" href="#pricing">
          Pricing
        </a>
        <a className="text-sm font-medium hover:underline underline-offset-4" href="#support">
          Support
        </a>
        <ThemeToggle />
        <Button variant="ghost" asChild>
          <Link href="/login">Log In</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Start Free Trial</Link>
        </Button>
      </nav>
    </header>
  )
}

export default Header
