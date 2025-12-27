import React, { useState, useEffect } from "react";

interface ClockProps {
  showSeconds?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Clock: React.FC<ClockProps> = ({ 
  showSeconds = false, 
  className = "",
  style 
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, showSeconds ? 1000 : 60000); // Update every second if showing seconds, otherwise every minute

    return () => clearInterval(timer);
  }, [showSeconds]);

  const formatTime = () => {
    const hours = time.getHours().toString().padStart(2, "0");
    const minutes = time.getMinutes().toString().padStart(2, "0");
    const seconds = time.getSeconds().toString().padStart(2, "0");
    
    if (showSeconds) {
      return `${hours}:${minutes}:${seconds}`;
    }
    return `${hours}:${minutes}`;
  };

  const formatDate = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const day = days[time.getDay()];
    const month = months[time.getMonth()];
    const date = time.getDate();
    const year = time.getFullYear();
    
    return `${day}, ${month} ${date}, ${year}`;
  };

  return (
    <div className={className} style={style}>
      <div className="text-white" style={{ fontFamily: "'Unbounded', sans-serif" }}>
        <div className="text-lg font-semibold tabular-nums">{formatTime()}</div>
        {showSeconds && (
          <div className="text-xs text-white/60 mt-0.5">{formatDate()}</div>
        )}
      </div>
    </div>
  );
};

