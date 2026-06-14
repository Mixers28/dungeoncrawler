'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function loginAction(email: string, password: string): Promise<{ error: string } | void> {
  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password.' };
    }
    throw error; // Re-throw so Next.js can handle the redirect
  }
}

export async function signUpAction(email: string, password: string): Promise<{ error: string } | void> {
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return { error: 'Email already registered.' };

    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email, passwordHash });

    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Registration failed. Please try again.' };
    }
    throw error;
  }
}
