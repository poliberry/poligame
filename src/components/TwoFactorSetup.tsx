import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MicaButton } from "./MicaButton";
import { MicaInput } from "./MicaInput";
import { useAuthStore } from "@/stores/authStore";
import { Shield, Check, X } from "lucide-react";

export const TwoFactorSetup: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState<"setup" | "verify" | "enabled">("setup");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setupTwoFactor = useMutation(api.auth.setupTwoFactor);
  const enableTwoFactor = useMutation(api.auth.enableTwoFactor);
  const disableTwoFactor = useMutation(api.auth.disableTwoFactor);
  const userData = useQuery(
    api.auth.getUserById,
    user?.userId ? { userId: user.userId as any } : "skip"
  );

  const isEnabled = userData?.twoFactorEnabled || false;

  const handleSetup = async () => {
    if (!user?.userId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await setupTwoFactor({ userId: user.userId as any });
      setQrCodeUrl(result.qrCodeUrl);
      setSecret(result.secret);
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Failed to setup 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!user?.userId || !verificationCode) return;

    setLoading(true);
    setError(null);
    try {
      const result = await enableTwoFactor({
        userId: user.userId as any,
        code: verificationCode,
      });
      setBackupCodes(result.backupCodes);
      setStep("enabled");
      // Update user in store
      if (user) {
        setUser({ ...user, twoFactorEnabled: true });
      }
    } catch (err: any) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!user?.userId) return;

    const password = prompt("Enter your password to disable 2FA:");
    if (!password) return;

    setLoading(true);
    setError(null);
    try {
      await disableTwoFactor({
        userId: user.userId as any,
        password,
      });
      setStep("setup");
      setQrCodeUrl("");
      setSecret("");
      setVerificationCode("");
      setBackupCodes([]);
      // Update user in store
      if (user) {
        setUser({ ...user, twoFactorEnabled: false });
      }
    } catch (err: any) {
      setError(err.message || "Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  if (isEnabled && step === "setup") {
    return (
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="text-green-500" size={24} />
          <h3 className="text-xl font-bold text-white">Two-Factor Authentication</h3>
          <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm">
            Enabled
          </span>
        </div>
        <p className="text-white/60 mb-4">
          Your account is protected with two-factor authentication.
        </p>
        <MicaButton
          variant="secondary"
          onClick={handleDisable}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Disabling..." : "Disable 2FA"}
        </MicaButton>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="text-white/60" size={24} />
        <h3 className="text-xl font-bold text-white">Two-Factor Authentication</h3>
      </div>

      {step === "setup" && (
        <>
          <p className="text-white/60 mb-4">
            Add an extra layer of security to your account. You'll need to enter a code from your authenticator app when you sign in.
          </p>
          <MicaButton
            variant="primary"
            onClick={handleSetup}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Setting up..." : "Enable 2FA"}
          </MicaButton>
        </>
      )}

      {step === "verify" && (
        <>
          <div className="mb-4">
            <p className="text-white/80 mb-2">Scan this QR code with your authenticator app:</p>
            {qrCodeUrl && (
              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                {/* In production, use a QR code library like qrcode.react */}
                <div className="w-48 h-48 bg-gray-200 flex items-center justify-center">
                  <p className="text-black text-xs text-center p-2">
                    QR Code: {qrCodeUrl}
                    <br />
                    Secret: {secret}
                  </p>
                </div>
              </div>
            )}
            <p className="text-white/60 text-sm mb-4">
              Or enter this secret manually: <code className="bg-black/30 px-2 py-1 rounded">{secret}</code>
            </p>
          </div>
          <div className="mb-4">
            <label className="text-sm text-white/80 mb-1 block">
              Enter verification code
            </label>
            <MicaInput
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="w-full"
            />
          </div>
          {error && (
            <div className="text-red-400 text-sm bg-red-500/20 border border-red-500/50 rounded p-2 mb-4">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <MicaButton
              variant="primary"
              onClick={handleEnable}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1"
            >
              {loading ? "Verifying..." : "Verify & Enable"}
            </MicaButton>
            <MicaButton
              variant="secondary"
              onClick={() => {
                setStep("setup");
                setQrCodeUrl("");
                setSecret("");
                setVerificationCode("");
              }}
              className="flex-1"
            >
              Cancel
            </MicaButton>
          </div>
        </>
      )}

      {step === "enabled" && (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="text-green-500" size={20} />
              <p className="text-green-400 font-semibold">2FA Enabled Successfully!</p>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </p>
            <div className="bg-black/30 rounded p-4 mb-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <code key={index} className="text-white/80 text-sm font-mono">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <MicaButton
              variant="secondary"
              onClick={() => {
                setStep("setup");
                setBackupCodes([]);
              }}
              className="w-full"
            >
              Done
            </MicaButton>
          </div>
        </>
      )}
    </div>
  );
};

