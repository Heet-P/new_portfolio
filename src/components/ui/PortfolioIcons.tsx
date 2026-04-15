import React from "react";

// The Document Icon (home.mdx, about.mdx, etc.)
export const MdxIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-md ${className}`}>
    <rect x="14" y="8" width="36" height="48" rx="3" fill="#F8F9FA" stroke="#343A40" strokeWidth="2" />
    <path d="M38 8L50 20V11C50 9.34315 48.6569 8 47 8H38Z" fill="#FF6B6B" stroke="#343A40" strokeWidth="2" strokeLinejoin="round" />
    <rect x="22" y="24" width="20" height="2" fill="#ADB5BD" />
    <rect x="22" y="32" width="20" height="2" fill="#ADB5BD" />
    <rect x="22" y="40" width="14" height="2" fill="#ADB5BD" />
    <text x="18" y="18" fontFamily="monospace" fontSize="8" fill="#343A40" fontWeight="bold">Aa</text>
  </svg>
);

// The Video/Demo Icon
export const DemoIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-md ${className}`}>
    <rect x="10" y="16" width="44" height="32" rx="2" fill="#495057" stroke="#343A40" strokeWidth="2" />
    <rect x="14" y="20" width="36" height="24" fill="#212529" />
    <path d="M28 26L40 32L28 38V26Z" fill="#F8F9FA" stroke="#F8F9FA" strokeWidth="2" strokeLinejoin="round" />
    <text x="15" y="14" fontFamily="sans-serif" fontSize="10" fill="#FF922B" fontWeight="bold">DEMO</text>
  </svg>
);

// The Folder Icon (Resume, Docs)
export const FolderIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-md ${className}`}>
    <path d="M8 46V18C8 16.8954 8.89543 16 10 16H24L30 22H54C55.1046 22 56 22.8954 56 24V46C56 47.1046 55.1046 48 54 48H10C8.89543 48 8 47.1046 8 46Z" fill="#FFC078" stroke="#343A40" strokeWidth="2" strokeLinejoin="round" />
    <rect x="16" y="26" width="20" height="24" fill="#F8F9FA" stroke="#343A40" strokeWidth="2" />
    <rect x="20" y="32" width="12" height="2" fill="#ADB5BD" />
    <rect x="20" y="38" width="12" height="2" fill="#ADB5BD" />
  </svg>
);

// The Human/Chat Icon
export const ContactIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={`drop-shadow-md ${className}`}>
    <rect x="12" y="20" width="40" height="28" rx="2" fill="#FFD43B" stroke="#343A40" strokeWidth="2" />
    <path d="M12 24L32 38L52 24" stroke="#343A40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);