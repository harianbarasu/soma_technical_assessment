import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recomputeSchedule, wouldCreateCycle } from '@/lib/scheduling';

interface Params { params: { id: string } }

export async function GET(request: Request, { params }: Params) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  try {
    const deps = await prisma.todoDependency.findMany({
      where: { dependentId: id },
      include: { dependency: true },
    });
    return NextResponse.json(deps);
  } catch (e) {
    return NextResponse.json({ error: 'Error fetching dependencies' }, { status: 500 });
  }
}

// Replace the dependency set for the given dependent task
export async function PUT(request: Request, { params }: Params) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  try {
    const { dependencyIds } = await request.json();
    if (!Array.isArray(dependencyIds)) {
      return NextResponse.json({ error: 'dependencyIds must be an array' }, { status: 400 });
    }

    const todos = await prisma.todo.findMany({ select: { id: true } });
    const deps = await prisma.todoDependency.findMany({ select: { dependentId: true, dependencyId: true } });

    const proposed = dependencyIds
      .filter((depId: string) => depId && depId !== id)
      .map((depId: string) => ({ dependencyId: depId, dependentId: id }));

    if (wouldCreateCycle(todos, deps, proposed)) {
      return NextResponse.json({ error: 'Circular dependency detected' }, { status: 400 });
    }

    // Replace dependencies: delete existing, then createMany
    await prisma.todoDependency.deleteMany({ where: { dependentId: id } });
    if (proposed.length > 0) {
      await prisma.todoDependency.createMany({ data: proposed });
    }

    await recomputeSchedule();

    const updated = await prisma.todo.findUnique({
      where: { id },
      include: {
        dependencies: { include: { dependency: true } },
        dependents: { include: { dependent: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Error updating dependencies' }, { status: 500 });
  }
}
