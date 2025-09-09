import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recomputeSchedule } from '@/lib/scheduling';

interface Params {
  params: {
    id: string;
  };
}

export async function DELETE(request: Request, { params }: Params) {
  const id = params.id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await prisma.todo.delete({
      where: { id },
    });
    try {
      const { recomputeSchedule } = await import('@/lib/scheduling');
      await recomputeSchedule();
    } catch {}
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const id = params.id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const data: any = {};
    if (typeof body.durationDays !== 'undefined') {
      const d = parseInt(String(body.durationDays), 10);
      if (!Number.isFinite(d) || d < 1) {
        return NextResponse.json({ error: 'durationDays must be a positive integer' }, { status: 400 });
      }
      data.durationDays = d;
    }
    if (typeof body.dueDate !== 'undefined') {
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      data.title = t;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.todo.update({ where: { id }, data });
    await recomputeSchedule();

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating todo' }, { status: 500 });
  }
}
