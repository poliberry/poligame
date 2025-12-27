import { useAuthStore } from "@/stores/authStore";
import React from "react";

const Profile: React.FC = () => {
  const { user } = useAuthStore();
  // Get the base URL from environment or default to localhost
  const baseUrl = import.meta.env.VITE_POLIGAME_BASE_URL || "http://localhost:3000";
  const profileUrl = `${baseUrl}/desktop/profile/${user?.userId}`;

  return (
    <div className="flex flex-col w-full h-full">
      <iframe
        src={profileUrl}
        className="w-full h-full border-0"
        title="Profile"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default Profile;
