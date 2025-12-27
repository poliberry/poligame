import React from "react";
import { MicaCard } from "@/components/MicaCard";
import { Wrench } from "lucide-react";

const ComingSoon: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-[var(--theme-accent)] to-background p-4">
      <MicaCard className="max-w-2xl w-full p-12 text-center">
        <div className="flex flex-col items-center gap-6">
          <div 
            className="w-24 h-24 rounded-full flex items-center justify-center"
          >
            <Wrench size={48} className="text-white" />
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">This feature is still in the works...</h1>
            <p className="text-white/60 text-lg">Coming Soon</p>
          </div>

          <div className="mt-4">
            <p className="text-white/80">
              Our team is working hard to bring you this feature.
            </p>
            <p className="text-white/60 text-sm mt-2">
              Stay tuned for updates!
            </p>
          </div>
        </div>
      </MicaCard>
    </div>
  );
};

export default ComingSoon;
