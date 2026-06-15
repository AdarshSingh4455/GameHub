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

