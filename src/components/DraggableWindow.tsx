import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

// Module-level z-index counter to manage window focus
let globalZIndex = 50;

interface DraggableWindowProps {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  onClose?: () => void;
  icon?: React.ReactNode;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  title,
  children,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 400, height: 500 },
  onClose,
  icon,
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);
  const [zIndex, setZIndex] = useState(globalZIndex++);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });
  const windowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const minWidth = 200;
  const minHeight = 150;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.mouseX;
        const deltaY = e.clientY - resizeStart.mouseY;

        let newWidth = resizeStart.startWidth;
        let newHeight = resizeStart.startHeight;
        let newX = resizeStart.startX;
        let newY = resizeStart.startY;

        // Handle resize based on direction
        if (resizeDirection.includes("e")) {
          // East (right) - resize from right edge
          const maxWidth = window.innerWidth - resizeStart.startX;
          newWidth = Math.max(
            minWidth,
            Math.min(resizeStart.startWidth + deltaX, maxWidth)
          );
        }
        if (resizeDirection.includes("w")) {
          // West (left) - resize from left edge
          const widthChange = resizeStart.startWidth - deltaX;
          if (widthChange >= minWidth && resizeStart.startX + deltaX >= 0) {
            newWidth = widthChange;
            newX = resizeStart.startX + deltaX;
          }
        }
        if (resizeDirection.includes("s")) {
          // South (bottom) - resize from bottom edge
          const maxHeight = window.innerHeight - resizeStart.startY;
          newHeight = Math.max(
            minHeight,
            Math.min(resizeStart.startHeight + deltaY, maxHeight)
          );
        }
        if (resizeDirection.includes("n")) {
          // North (top) - resize from top edge
          const heightChange = resizeStart.startHeight - deltaY;
          if (heightChange >= minHeight && resizeStart.startY + deltaY >= 0) {
            newHeight = heightChange;
            newY = resizeStart.startY + deltaY;
          }
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      } else if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Constrain to viewport
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - 50; // Account for header height

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    resizeDirection,
    dragOffset,
    size,
    position,
    resizeStart,
  ]);

  const handleFocus = () => {
    // Bring window to front by setting highest z-index
    const newZIndex = ++globalZIndex;
    setZIndex(newZIndex);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current) return;

    // Focus the window when clicked
    handleFocus();

    const rect = headerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleWindowClick = (e: React.MouseEvent) => {
    // Focus window when clicking anywhere on it (but not on resize handles)
    if (!(e.target as HTMLElement).closest('.resize-handle')) {
      handleFocus();
    }
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    if (!windowRef.current) return;

    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    });
    setResizeDirection(direction);
    setIsResizing(true);
  };

  // Resize handle styles
  const resizeHandleClass = "absolute bg-transparent z-10";
  const resizeHandleHoverClass = "hover:bg-primary/20";

  return (
    <div
      ref={windowRef}
      className="absolute select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: zIndex,
      }}
      onClick={handleWindowClick}
    >
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
      <Card className="h-full flex flex-col bg-background backdrop-blur-sm border-1 rounded-md shadow-2xl p-0">
        {/* Header */}
        <div
          ref={headerRef}
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b cursor-move hover:bg-muted/70 transition-colors"
        >
          <div className="flex items-center gap-2 flex-1">
            {icon && <div className="text-muted-foreground">{icon}</div>}
            <h3
              className="font-semibold text-xs uppercase italic"
              style={{ fontFamily: "Unbounded, sans-serif" }}
            >
              {title}
            </h3>
            <GripVertical className="h-4 w-4 text-muted-foreground ml-auto" />
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-2"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </Card>

      {/* Resize Handles */}
      {/* Corners */}
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} top-0 left-0 w-4 h-4 cursor-nwse-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "nw");
          handleFocus();
        }}
      />
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} top-0 right-0 w-4 h-4 cursor-nesw-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "ne");
          handleFocus();
        }}
      />
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} bottom-0 left-0 w-4 h-4 cursor-nesw-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "sw");
          handleFocus();
        }}
      />
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} bottom-0 right-0 w-4 h-4 cursor-nwse-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "se");
          handleFocus();
        }}
      />

      {/* Edges */}
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} top-0 left-4 right-4 h-1 cursor-ns-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "n");
          handleFocus();
        }}
      />
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} bottom-0 left-4 right-4 h-1 cursor-ns-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "s");
          handleFocus();
        }}
      />
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} left-0 top-4 bottom-4 w-1 cursor-ew-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "w");
          handleFocus();
        }}
      />
      <div
        className={`resize-handle ${resizeHandleClass} ${resizeHandleHoverClass} right-0 top-4 bottom-4 w-1 cursor-ew-resize`}
        onMouseDown={(e) => {
          handleResizeStart(e, "e");
          handleFocus();
        }}
      />
    </div>
  );
};
