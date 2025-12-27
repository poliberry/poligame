import React from "react";
import { FriendsWindow } from "@/components/FriendsWindow";
import { useNavigate } from "react-router-dom";

const Friends: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen">
      <FriendsWindow onClose={() => navigate("/")} />
    </div>
  );
};

export default Friends;

