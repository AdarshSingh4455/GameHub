import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version: 'v1.1.0',
    whatsNew: [
      'Mobile-first UI/UX overhaul centering all pages and components',
      'Universal display of equipped avatar frames and custom titles',
      'Store upgrade including Mystery Crate animations and scratcher rewards pool expansion',
      'App version update detection and flexible release delivery framework'
    ]
  })
}
