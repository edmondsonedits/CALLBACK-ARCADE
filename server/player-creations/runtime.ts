import { ensureDatabase, getD1, runtimeEnv } from "../database";
import { PlayerCreationService } from "./service";

let service: PlayerCreationService | null = null;
export async function playerCreationService(): Promise<PlayerCreationService> {
  await ensureDatabase();
  if (service) return service;
  const media = runtimeEnv().MEDIA;
  return service = new PlayerCreationService(getD1(), media);
}
