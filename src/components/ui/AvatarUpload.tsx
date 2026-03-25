"use client";
import React, { useRef } from 'react';
import { Camera, User } from 'lucide-react';

interface AvatarUploadProps {
  value: string;
  onChange: (base64: string) => void;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function AvatarUpload({ value, onChange, name = '', size = 'md' }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16 rounded-2xl text-lg',
    md: 'w-28 h-28 rounded-[2.5rem] text-3xl',
    lg: 'w-36 h-36 rounded-[3rem] text-4xl',
  };

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '';

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) onChange(result);
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="relative group w-fit">
      <div
        className={`${sizeClasses[size]} overflow-hidden border-4 border-primary/20 bg-white/80 shadow-xl transition-all group-hover:border-primary/50 cursor-pointer`}
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <img src={value} className="w-full h-full object-cover" alt="Avatar" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10 font-black text-primary">
            {initials || <User className="w-8 h-8" />}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute -right-2 -bottom-2 bg-primary text-black p-2.5 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"
      >
        <Camera className="w-4 h-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
