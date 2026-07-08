import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

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

export const gameSessions = pgTable('game_sessions', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionState: jsonb('session_state').notNull(),
  version: integer('version').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('game_sessions_owner_user_id_idx').on(table.ownerUserId),
  index('game_sessions_status_idx').on(table.status),
]);

export const sessionPlayers = pgTable('session_players', {
  sessionId: text('session_id').notNull().references(() => gameSessions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  characterState: jsonb('character_state').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.userId] }),
  index('session_players_user_id_idx').on(table.userId),
]);
