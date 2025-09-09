import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchPexelsImage } from '@/lib/pexels';

interface Params { params: { id: string } }

export async function POST(req: Request, { params }: Params) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  try {
    const todo = await prisma.todo.findUnique({ where: { id } });
    if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!process.env.PEXELS_API_KEY) {
      return NextResponse.json({ error: 'PEXELS_API_KEY not configured' }, { status: 400 });
    }
    const imageUrl = await fetchPexelsImage(todo.title);
    if (!imageUrl) return NextResponse.json({ error: 'No image found' }, { status: 404 });
    const updated = await prisma.todo.update({ where: { id }, data: { imageUrl } });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Error fetching image' }, { status: 500 });
  }
}

