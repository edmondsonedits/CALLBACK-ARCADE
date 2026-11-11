import { getD1 } from "../database";
import { CharacterProfileService } from "./service";

let service: CharacterProfileService | null = null;
export function profileService(): CharacterProfileService { return service ??= new CharacterProfileService(getD1()); }
