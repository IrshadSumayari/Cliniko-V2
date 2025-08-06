"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserPlus, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"

const SignupForm = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    clinicName: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)
  const { signUp, signInWithGoogle, isLoading } = useAuth()
  const router = useRouter()

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleGoogleSignup = async () => {
    const success = await signInWithGoogle()
    if (success) {
      router.push("/")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.clinicName || !formData.password) {
      return
    }

    if (formData.password !== formData.confirmPassword) {
      return
    }

    if (formData.password.length < 6) {
      return
    }

    const success = await signUp(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName,
      formData.clinicName,
    )

    if (success) {
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent flex items-center justify-center p-4">
      {/* Back to Landing Button */}
      <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-float)]">
        <div className="text-center mb-8">
          <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-4">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Create Account</h1>
          <p className="text-muted-foreground">Start tracking your patient sessions</p>
        </div>

        {/* Google Signup - Primary Option */}
        <Button
          onClick={handleGoogleSignup}
          variant="outline"
          className="w-full mb-4 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 font-medium"
          disabled={isLoading}
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLoading ? "Creating Account..." : "Continue with Google"}
        </Button>

        <div className="relative mb-6">
          <Separator />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-background px-2 text-xs text-muted-foreground">or</span>
          </div>
        </div>

        {/* Manual Signup Option */}
        {!showManualForm ? (
          <Button variant="outline" onClick={() => setShowManualForm(true)} className="w-full">
            Sign up with email
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                disabled={isLoading}
              />
              <Input
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              disabled={isLoading}
            />

            <Input
              placeholder="Clinic Name"
              value={formData.clinicName}
              onChange={(e) => handleChange("clinicName", e.target.value)}
              disabled={isLoading}
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            <Input
              type="password"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              disabled={isLoading}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>

            <Button type="button" variant="ghost" onClick={() => setShowManualForm(false)} className="w-full text-sm">
              Back to quick signup
            </Button>
          </form>
        )}

        <Separator className="my-6" />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}

export default SignupForm
