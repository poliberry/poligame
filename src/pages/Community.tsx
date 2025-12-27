import React from "react";

const Community: React.FC = () => {
  // Get the base URL from environment or default to localhost
  const baseUrl = import.meta.env.VITE_POLIGAME_BASE_URL || "http://localhost:3000";
  const forumUrl = `${baseUrl}/desktop/forum`;

  return (
    <div className="flex flex-col w-full h-full">
      <iframe
        src={forumUrl}
        className="w-full h-full border-0"
        title="Community Forum"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default Community;
