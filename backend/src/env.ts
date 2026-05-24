import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  SESSION_SECRET: z.string().min(32),
  STEAM_API_KEY: z.string().min(1),
  STEAM_REALM: z.string().url(),
  STEAM_RETURN_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
