'use client';

import { User } from 'lucide-react';

interface UserAvatarProps {
  user?: {
    username?: string;
    role?: string;
    name?: string | null;
  } | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  darkMode?: boolean;
}

export function UserAvatar({ user, size = 'md', className = '', darkMode = false }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  const selectedSizeClass = sizeClasses[size];

  return (
    <div className={`${selectedSizeClass} rounded-full flex items-center justify-center overflow-hidden border ${
      darkMode ? 'border-gray-700' : 'border-gray-200'
    } ${className}`}>
      <img 
        src="/img/user.png" 
        alt="avatar" 
        className="w-full h-full object-cover"
      />
    </div>
  );
}
