import React, { useState } from "react";
import { X, QrCode } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MicaButton } from "./MicaButton";
import { MicaInput } from "./MicaInput";
import { useAuthStore } from "@/stores/authStore";
import { QRCodeScanner } from "./QRCodeScanner";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "signup";
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  isOpen,
  onClose,
  initialMode = "signin",
}) => {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useMutation(api.auth.signIn);
  const signUp = useMutation(api.auth.signUp);
  const { setUser, setLoading, setError: setAuthError } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        await signUp({
          email,
          password,
          username: username || undefined,
        });
        // Automatically sign in after sign up
        const signInResult = await signIn({ email, password });
        if (!signInResult.requiresTwoFactor) {
          setUser(signInResult as any);
          onClose();
        }
      } else {
        const result = await signIn({ 
          email, 
          password,
          twoFactorCode: requiresTwoFactor ? twoFactorCode : undefined,
        });
        
        if (result.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setLoading(false);
          return;
        }
        
        // result is a full user object when requiresTwoFactor is false
        setUser(result as any);
        onClose();
      }
      // Reset form
      setEmail("");
      setPassword("");
      setUsername("");
      setTwoFactorCode("");
      setRequiresTwoFactor(false);
    } catch (err: any) {
      const errorMessage = err.message || "An error occurred";
      setError(errorMessage);
      setAuthError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = async (token: string) => {
    // QR code scanning is handled by the Auth page
    // This is just a placeholder - the actual QR flow is in Auth.tsx
    setShowQRScanner(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md"
        style={{
          backgroundColor: "rgba(0, 110, 75, 0.9)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-row justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <div>
              <label className="text-sm text-white/80 mb-1 block">Username (optional)</label>
              <MicaInput
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-white/80 mb-1 block">Email</label>
            <MicaInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full"
              required
            />
          </div>

          <div>
            <label className="text-sm text-white/80 mb-1 block">Password</label>
            <MicaInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full"
              required
            />
          </div>

          {requiresTwoFactor && (
            <div>
              <label className="text-sm text-white/80 mb-1 block">2FA Code</label>
              <MicaInput
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full"
                maxLength={6}
                required
              />
              <p className="text-xs text-white/60 mt-1">
                Enter the code from your authenticator app
              </p>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-500/20 border border-red-500/50 rounded p-2">
              {error}
            </div>
          )}

          <MicaButton type="submit" variant="primary" className="w-full">
            {requiresTwoFactor ? "Verify" : mode === "signin" ? "Sign In" : "Sign Up"}
          </MicaButton>
        </form>

        {mode === "signin" && !requiresTwoFactor && (
          <div className="mt-4">
            <MicaButton
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setShowQRScanner(true)}
            >
              <QrCode size={18} />
              Login with QR Code
            </MicaButton>
          </div>
        )}

        {showQRScanner && (
          <QRCodeScanner
            onScan={handleQRScan}
            onClose={() => setShowQRScanner(false)}
          />
        )}

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="text-white/60 hover:text-white text-sm"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

