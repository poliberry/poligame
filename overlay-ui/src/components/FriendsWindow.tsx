import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Users, UserPlus, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";

export const FriendsWindow: React.FC = () => {
  const friends = useQuery(api.friends.getFriends) || [];
  const addFriend = useMutation(api.friends.addFriend);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Friends</h3>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-2">
        {friends.length === 0 ? (
          <p className="text-muted-foreground text-center">No friends yet</p>
        ) : (
          friends.map((friend: any) => (
            <div
              key={friend._id}
              className="p-3 bg-muted rounded flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{friend.username || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">
                  {friend.status || "Offline"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};


