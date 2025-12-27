import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../convex/_generated/api";
import { useAuthStore } from "@/stores/authStore";
import {
  Card,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Id } from "convex/_generated/dataModel";
// @ts-ignore
import loginVideo from "@/public/login-video.mp4";

export const Auth: React.FC = () => {
  const [mode, setMode] = useState<"signin" | "signup" | "qr">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrRegenerateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const signIn = useMutation(api.auth.signIn);
  const signUp = useMutation(api.auth.signUp);
  const updateUserProfile = useMutation(api.user.updateUserProfile);
  const generateQRToken = useMutation(api.auth.generateQRLoginToken);
  const markQRTokenAsUsed = useMutation(api.auth.markQRTokenAsUsed);
  const qrStatus = useQuery(
    api.auth.verifyQRLoginToken,
    qrToken ? { token: qrToken } : "skip"
  );
  const { setUser, setLoading, setError: setAuthError } = useAuthStore();

  const handleGenerateQR = useCallback(async () => {
    try {
      // Stop polling if active
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Clear old token first
      if (qrToken) {
        setQrToken(null);
      }

      // Get device name and approximate location
      let deviceName = "Unknown Device";
      let location = "Unknown Location";

      try {
        deviceName = (await invoke("get_computer_name")) || "Unknown Device";
      } catch (err) {
        console.error("Error getting computer name:", err);
      }

      // Try to get approximate location (simplified - could use IP geolocation)
      try {
        // For now, just use a placeholder - in production you'd use IP geolocation
        location = "Local Network";
      } catch (err) {
        console.error("Error getting location:", err);
      }

      const result = await generateQRToken({
        deviceName,
        location,
      });
      setQrToken(result.token);
      setError(null);
    } catch (err: any) {
      console.error("Error generating QR code:", err);
      setError(err.message || "Failed to generate QR code");
    }
  }, [qrToken, generateQRToken]);

  // Poll for QR authorization
  useEffect(() => {
    if (qrToken && qrStatus?.status === "pending") {
      // Keep polling - Convex will handle the query updates
      return;
    }

    if (qrStatus?.status === "authorized" && qrStatus.user) {
      // Stop polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Mark token as used and login
      const handleAuthorization = async () => {
        if (qrToken) {
          try {
            await markQRTokenAsUsed({ token: qrToken });
          } catch (err) {
            console.error("Error marking QR token as used:", err);
          }
        }

        // Login the user
        setUser({
          email: qrStatus.user!.email,
          username: qrStatus.user!.username ?? "",
          avatar: qrStatus.user!.avatar,
          bio: qrStatus.user!.bio,
          steamUserId: qrStatus.user!.steamUserId,
          epicUserId: qrStatus.user!.epicUserId,
          eaUserId: qrStatus.user!.eaUserId,
          rockstarUserId: qrStatus.user!.rockstarUserId,
          twoFactorEnabled: (qrStatus.user as any).twoFactorEnabled || false,
          requiresTwoFactor: false,
          userId: qrStatus.user!.userId,
          novuSubscriberId: qrStatus.user!.novuSubscriberId,
        });

        // Close the window after a brief delay to show the user info
        setTimeout(() => {
          try {
            invoke("close_auth_window");
          } catch (err) {
            console.error("Error closing auth window:", err);
          }
        }, 2000);
      };

      handleAuthorization();
    }

    if (
      qrStatus?.status === "expired" ||
      qrStatus?.status === "used" ||
      qrStatus?.status === "invalid"
    ) {
      // Token was cancelled or invalid, regenerate QR code
      setQrToken(null);
      setError(null);
      // Generate new QR code after a brief delay
      setTimeout(() => {
        handleGenerateQR();
      }, 500);
    }
  }, [qrStatus, qrToken, setUser, markQRTokenAsUsed, handleGenerateQR]);

  // Auto-generate QR code on mount and regenerate every 5 minutes
  useEffect(() => {
    // Generate initial QR code
    const generateInitial = async () => {
      await handleGenerateQR();
    };
    generateInitial();

    // Set up interval to regenerate every 5 minutes (300000 ms)
    qrRegenerateIntervalRef.current = setInterval(async () => {
      await handleGenerateQR();
    }, 5 * 60 * 1000);

    // Cleanup on unmount
    return () => {
      if (qrRegenerateIntervalRef.current) {
        clearInterval(qrRegenerateIntervalRef.current);
        qrRegenerateIntervalRef.current = null;
      }
    };
  }, []); // Only run on mount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setLoading(true);

    try {
      let userData;

      if (mode === "signup") {
        // Sign up and automatically sign in
        await signUp({
          email,
          password,
          username: username || undefined,
        });
        // Automatically sign in after sign up
        userData = await signIn({ email, password });
      } else {
        // Sign in
        userData = await signIn({ email, password });
      }

      if(!userData.novuSubscriberId) {
        // Create Novu subscriber via Tauri command (works in both dev and production)
        // Try Tauri command first (production), fallback to API route (dev)
        try {
          const novuResponse = await invoke("create_novu_subscriber", {
            subscriberId: userData.userId,
            email: userData.email,
            firstName: userData.username || undefined,
            avatar: userData.avatar || undefined,
          });

          await updateUserProfile({
            userId: userData.userId as Id<"users">,
            novuSubscriberId: (novuResponse as any).subscriberId,
          });
        } catch (tauriError) {
          // Fallback to API route for dev mode
          try {
            const response = await fetch("/api/novu/subscriber", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                subscriberId: userData.userId,
                email: userData.email,
                firstName: userData.username || undefined,
                avatar: userData.avatar || undefined,
              }),
            });

            // Check if response is JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              // Got HTML instead of JSON (likely 404 in production)
              throw new Error("API route not available (production build)");
            }

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: "Unknown error" }));
              throw new Error(error.error || "Failed to create Novu subscriber");
            }

            const novuResponse = await response.json();

            await updateUserProfile({
              userId: userData.userId as Id<"users">,
              novuSubscriberId: novuResponse.subscriberId,
            });
          } catch (fetchError: any) {
            console.error("Failed to create Novu subscriber via both methods:", { tauriError, fetchError });
            // Don't throw - allow login to continue even if Novu fails
          }
        }
      }

      // Ensure userData matches User type (fill in required fields if missing)
      // CAUTION: this assumes email and username are required in User type.
      // This preserves backwards compatibility if backend doesn't respond with all User fields.
      setUser({
        email: userData.email ?? email,
        username: userData.username ?? username ?? "",
        avatar: userData.avatar,
        bio: userData.bio,
        steamUserId: userData.steamUserId,
        epicUserId: userData.epicUserId,
        eaUserId: userData.eaUserId,
        rockstarUserId: userData.rockstarUserId,
        twoFactorEnabled: userData.twoFactorEnabled,
        requiresTwoFactor: userData.requiresTwoFactor ?? false,
        userId: userData.userId,
        novuSubscriberId: userData.novuSubscriberId,
      });

      // Close the window after successful authentication
      try {
        await invoke("close_auth_window");
      } catch (err) {
        console.error("Error closing auth window:", err);
        // Fallback: try to close using getCurrentWindow if invoke fails
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const window = getCurrentWindow();
          await window.close();
        } catch (fallbackErr) {
          console.error("Fallback window close also failed:", fallbackErr);
        }
      }

      // Reset form
      setEmail("");
      setPassword("");
      setUsername("");
    } catch (err: any) {
      const errorMessage = err.message || "An error occurred";
      setError(errorMessage);
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen text-white drag-region relative">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Livvic:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,900&family=Unbounded:wght@200..900&display=swap"
        rel="stylesheet"
      ></link>
      <video
        src={loginVideo}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover absolute top-0 left-0 z-0"
      />
      <div className="w-full h-full flex items-center justify-center z-10 bg-black/50 backdrop-blur-sm absolute p-12 top-0 left-0">
        <X
          size={20}
          className="absolute top-4 right-4 text-white cursor-pointer"
          onClick={() => {
            invoke("close_auth_window");
          }}
        />
        <Card className="w-full h-full dark p-6">
          <CardContent className="h-full">
            <div className="flex flex-row w-full h-full justify-center items-center gap-8">
              {/* Login Form Section */}
              <div className="flex-1 flex flex-col max-w-md">
                <CardTitle
                  className="text-2xl uppercase italic text-left mb-6"
                  style={{
                    fontFamily: "Unbounded, sans-serif",
                    fontWeight: "600",
                  }}
                >
                  Ready to play?
                </CardTitle>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {mode === "signup" && (
                      <div>
                        <Label
                          className="text-sm text-white/80 mb-1 block"
                          style={{ fontFamily: "Livvic, sans-serif" }}
                        >
                          Username (optional)
                        </Label>
                        <Input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter username"
                          className="w-full"
                        />
                      </div>
                    )}

                    <div>
                      <Label
                        className="text-sm text-white/80 mb-1 block"
                        style={{ fontFamily: "Livvic, sans-serif" }}
                      >
                        Email
                      </Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full"
                        required
                      />
                    </div>

                    <div>
                      <Label
                        className="text-sm text-white/80 mb-1 block"
                        style={{ fontFamily: "Livvic, sans-serif" }}
                      >
                        Password
                      </Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full"
                        required
                      />
                    </div>

                  {error && (
                    <div className="text-red-400 text-sm bg-red-500/20 border border-red-500/50 rounded p-2">
                      {error}
                    </div>
                  )}
                  <div className="flex flex-row justify-end gap-2">
                    <Button
                      variant="link"
                      onClick={() => {
                        setMode(mode === "signin" ? "signup" : "signin");
                        setError(null);
                      }}
                      className="text-white/60 hover:text-white text-sm"
                      disabled={isLoading}
                    >
                      {mode === "signin"
                        ? "Don't have an account? Sign up"
                        : "Already have an account? Sign in"}
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      className="w-fit self-end text-sm"
                      disabled={isLoading}
                    >
                      {isLoading
                        ? "Please wait..."
                        : mode === "signin"
                          ? "Sign In"
                          : "Sign Up"}
                    </Button>
                  </div>
                </form>
              </div>

              {/* QR Code Section */}
              <div className="flex-1 flex flex-col items-center justify-center max-w-md">
                {(qrStatus?.status === "authorized" || qrStatus?.status === "pending-acceptance") && qrStatus.user ? (
                  <div className="flex flex-col gap-4 items-center">
                    <CardTitle
                      className="text-2xl uppercase italic text-center mb-6"
                      style={{
                        fontFamily: "Unbounded, sans-serif",
                        fontWeight: "600",
                      }}
                    >
                      {qrStatus.status === "authorized" ? "Welcome back!" : "Waiting for approval..."}
                    </CardTitle>
                    <div className="relative w-32 h-32">
                      {qrStatus.user.avatar ? (
                        <img
                          src={qrStatus.user.avatar}
                          alt={qrStatus.user.username || qrStatus.user.email}
                          className="w-32 h-32 rounded-full border-4 border-blue-500 object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                            if (fallback) {
                              (fallback as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div 
                        className={`avatar-fallback w-32 h-32 rounded-full bg-blue-600/20 border-4 border-blue-500 flex items-center justify-center ${qrStatus.user.avatar ? 'hidden' : ''}`}
                      >
                        <span className="text-5xl font-bold text-white">
                          {(qrStatus.user.username || qrStatus.user.email || "U")[0]?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xl text-white font-semibold">
                      {qrStatus.user.username || qrStatus.user.email}
                    </p>
                    <p className="text-white/60 text-sm text-center">
                      {qrStatus.status === "authorized" 
                        ? "Logging you in..." 
                        : "Please approve the login request on your mobile device"}
                    </p>
                  </div>
                ) : (
                  <>
                    <CardTitle
                      className="text-2xl uppercase italic text-center mb-6"
                      style={{
                        fontFamily: "Unbounded, sans-serif",
                        fontWeight: "600",
                      }}
                    >
                      Scan with Mobile App
                    </CardTitle>
                    {qrToken ? (
                      <div className="flex flex-col gap-4 items-center">
                        <div className="bg-white p-4 rounded-lg">
                          <QRCodeSVG
                            value={`poligame://login?token=${qrToken}`}
                            size={200}
                          />
                        </div>
                        <p className="text-white/60 text-sm text-center">
                          Scan this QR code with your PoliGame mobile app to login
                        </p>
                        {qrStatus?.status === "pending" && (
                          <p className="text-blue-400 text-sm">
                            Waiting for authorization...
                          </p>
                        )}
                        {qrStatus?.status === "expired" && (
                          <p className="text-yellow-400 text-sm">
                            QR code expired. Generating new one...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 items-center">
                        <div className="bg-white/10 p-4 rounded-lg w-[200px] h-[200px] flex items-center justify-center">
                          <p className="text-white/40 text-sm text-center">Generating QR code...</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

{
  /* 
  <div
        className="bg-black/90 border border-white/20 rounded-lg p-8 w-full max-w-md mx-4"
        style={{
          backgroundColor: "rgba(0, 110, 75, 0.9)",
        }}
      >
        <div className="flex flex-row justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </h1>
        </div>

       

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
  */
}
