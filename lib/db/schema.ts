import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedGames = pgTable('saved_games', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  gameState: jsonb('game_state').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
