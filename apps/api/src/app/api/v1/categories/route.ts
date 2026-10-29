import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EXPENSE_CATEGORIES } from '@tripcircle/contracts';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      for (const cat of EXPENSE_CATEGORIES) {
        await prisma.expenseCategory.upsert({
          where: { key: cat.key },
          update: { name: cat.name, icon: cat.icon },
          create: { key: cat.key, name: cat.name, icon: cat.icon, isSystem: true },
        });
      }
      categories = await prisma.expenseCategory.findMany({
        orderBy: { name: 'asc' },
      });
    }

    return successResponse(categories);
  } catch (err) {
    return handleApiError(err);
  }
}
