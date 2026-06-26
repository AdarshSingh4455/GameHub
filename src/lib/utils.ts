import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { prisma } from './prisma'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateFriendCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `GH-${code}`
}

export async function getUniqueFriendCode(): Promise<string> {
  let attempts = 0
  while (attempts < 100) {
    const code = generateFriendCode()
    const existing = await prisma.profile.findUnique({
      where: { friendCode: code },
    })
    if (!existing) return code
    attempts++
  }
  return `GH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
}


export function parseISTDateTime(dateStr: string, timeStr: string | null): Date {
  let hours = 10;
  let minutes = 0;
  if (timeStr) {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3];
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
    }
  }
  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  return new Date(`${dateStr}T${hh}:${mm}:00+05:30`);
}

export function parseIST(val: string | null | undefined): Date | null {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) {
    return new Date(`${val}:00+05:30`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(`${val}T00:00:00+05:30`);
  }
  if (val.includes('Z') || /[+-]\d{2}:\d{2}$/.test(val)) {
    return new Date(val);
  }
  return new Date(`${val}+05:30`);
}
