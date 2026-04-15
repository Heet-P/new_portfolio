"use client";

import { motion, Variants } from "framer-motion";
import { ReactNode, useState, useEffect } from "react";

interface MacWindowProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultPosition?: { x: number; y: number };
  width?: string;
  height?: string;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  originRect?: DOMRect;
  // NEW PROP: Reports if this window is currently maximized
  onMaximize?: (isMaximized: boolean) => void; 
}

export function MacWindow({
  title,
  children,
  defaultPosition = { x: 0, y: 0 },
  width = "w-[600px]",
  height = "h-[400px]",
  isActive,
  onFocus,
  onClose,
  originRect,
  onMaximize,
}: MacWindowProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  // Math to calculate distance from screen center to the icon
  const getOriginOffset = () => {
    if (!originRect || typeof window === "undefined") return { x: 0, y: 0 };
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    const iconCenterX = originRect.left + (originRect.width / 2);
    const iconCenterY = originRect.top + (originRect.height / 2);
    return { x: iconCenterX - screenCenterX, y: iconCenterY - screenCenterY };
  };

  const origin = getOriginOffset();

  // Optimized typed variants with no blur and will-change
  const genieVariants: Variants = {
    closed: {
      opacity: 0,
      scale: 0.05,
      x: origin.x,
      y: origin.y,
    },
    opened: {
      opacity: 1,
      scale: 1,
      x: defaultPosition.x,
      y: defaultPosition.y,
      transition: {
        type: "spring",
        stiffness: 280,
        damping: 25,
        mass: 0.8,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.05,
      x: origin.x,
      y: origin.y,
      transition: {
        duration: 0.25,
        // STRICT TUPLE FIX APPLIED HERE
        ease: [0.32, 0, 0.67, 0] as [number, number, number, number],
      },
    },
  };

  // Toggle maximize state and call the prop
  const toggleMaximize = () => {
    const nextMaximizeState = !isMaximized;
    setIsMaximized(nextMaximizeState);
    if (onMaximize) onMaximize(nextMaximizeState);
  };

  // Reset maximization state when prop is missing (defensive)
  useEffect(() => {
    if(!onMaximize) setIsMaximized(false);
  }, [onMaximize]);

  return (
    <motion.div
      variants={genieVariants}
      initial="closed"
      animate="opened"
      exit="exit"
      drag={!isMaximized}
      dragMomentum={false}
      onMouseDown={onFocus}
      style={{ willChange: "transform, opacity" }}
      className={`absolute flex flex-col overflow-hidden border transition-[box-shadow,border-color] duration-300 pointer-events-auto ${
        isActive 
          ? "border-white/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] z-50" 
          : "border-white/10 shadow-2xl z-40"
      } bg-[#1c1c1e]/90 backdrop-blur-[20px] 
      ${isMaximized 
          ? '!w-screen !h-[calc(100vh-32px)] !top-8 !left-0 !transform-none !rounded-none !border-none' 
          : `${width} ${height} rounded-lg`
      }`}
    >
      <div 
        onDoubleClick={toggleMaximize}
        className="h-10 flex items-center justify-between border-b border-white/10 bg-black/20 w-full shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-3 px-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <span className="text-xs font-medium text-zinc-300 tracking-wide">{title}</span>
        </div>
        
        <div className="flex h-full">
          <button onClick={onClose} className="h-full px-4 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0,5 L10,5" stroke="currentColor" strokeWidth="1"/></svg>
          </button>
          <button onClick={toggleMaximize} className="h-full px-4 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
          </button>
          <button onClick={onClose} className="h-full px-4 hover:bg-[#e81123] text-zinc-400 hover:text-white flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-y-auto overflow-x-hidden bg-black/40 no-scrollbar">
        {children}
      </div>
    </motion.div>
  );
}