import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchPexelsImage } from '@/lib/pexels';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        dependencies: { include: { dependency: true } },
        dependents: { include: { dependent: true } },
      },
    });
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching todos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, dueDate, durationDays } = await request.json();
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    // Create first to get an ID, then try to enrich with an image
    let todo = await prisma.todo.create({
      data: {
        title,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        durationDays: typeof durationDays === 'number' && durationDays > 0 ? Math.floor(durationDays) : 1,
      },
    });

    const imageUrl = await fetchPexelsImage(title);
    if (imageUrl) {
      todo = await prisma.todo.update({ where: { id: todo.id }, data: { imageUrl } });
    }

    // Recompute scheduling fields after mutation
    try {
      const { recomputeSchedule } = await import('@/lib/scheduling');
      await recomputeSchedule();
    } catch {}

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating todo' }, { status: 500 });
  }
}
