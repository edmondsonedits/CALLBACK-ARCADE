import { ensureDatabase, getD1, runtimeEnv } from "../database";
import { ProfileFaceService } from "./service";

let service: ProfileFaceService | null = null;
export async function profileFaceService(): Promise<ProfileFaceService> {
  await ensureDatabase();
  if (service) return service;
  const config = runtimeEnv();
  if (!config.MEDIA) throw new Error("PROFILE_FACE_STORAGE_UNAVAILABLE");
  return service = new ProfileFaceService({ db: getD1(), storage: config.MEDIA, imageKey: config.OPENAI_IMAGE_API_KEY, guard: config });
}
