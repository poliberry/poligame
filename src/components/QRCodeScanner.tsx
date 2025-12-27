import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface QRCodeScannerProps {
  onScan: (token: string) => void;
  onClose: () => void;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onClose }) => {
  const [inputValue, setInputValue] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Try to access camera for QR scanning
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        console.error("Camera access denied:", err);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleManualInput = () => {
    if (inputValue.trim()) {
      // Extract token from URL or use as-is
      const url = new URL(inputValue);
      const token = url.searchParams.get("token") || inputValue;
      onScan(token);
    }
  };

  return (
    <div className="mt-4 p-4 bg-black/50 rounded-lg border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Scan QR Code</h3>
        <button onClick={onClose} className="text-white/60 hover:text-white">
          <X size={18} />
        </button>
      </div>
      
      <div className="mb-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-48 bg-black rounded"
        />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Or paste QR code URL/token"
          className="flex-1 bg-white/10 text-white px-3 py-2 rounded border border-white/20"
        />
        <button
          onClick={handleManualInput}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

