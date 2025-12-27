import React from "react";

const Marketplace: React.FC = () => {
  // Get the base URL from environment or default to localhost
  const baseUrl = import.meta.env.VITE_POLIGAME_BASE_URL || "http://localhost:3000";
  const marketplaceUrl = `${baseUrl}/desktop`;

  return (
    <div className="flex flex-col w-full h-full">
      <iframe
        src={marketplaceUrl}
        className="w-full h-full border-0"
        title="Marketplace"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default Marketplace;
