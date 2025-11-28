"use client";

import { UserButton } from '@stackframe/stack'
import React, { useEffect } from 'react'
import Image from 'next/image'

function AppHeader( {children} ) {
  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  };

  const toggleTheme = () => {
    const current =
      localStorage.getItem('theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) applyTheme(saved);
  }, []);

  return (
    <div className='p-3 flex justify-between item-center'>
        <Image src="/eduvi-logo.png" alt="Eduvi Logo" width={100} height={100} />

        <UserButton colorModeToggle={toggleTheme} />
    </div>
  )
}

export default AppHeader