import { getD1, runtimeEnv } from "../database";
import { retireNativeArcadeRoomWith, type NativeControlConfig } from "./retirement";

export { retireNativeArcadeRoomWith } from "./retirement";

export async function retireNativeArcadeRoom(code: string): Promise<void> {
  return retireNativeArcadeRoomWith(getD1(), runtimeEnv() as NativeControlConfig, code);
}
