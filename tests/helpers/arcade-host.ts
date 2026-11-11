import { expect, type Page } from "@playwright/test";
import { ARCADE_GAMES } from "../../lib/arcade/catalog";

export async function expectArcadeRoomLobby(page: Page, code: string, gameId: string) {
  const game = ARCADE_GAMES.find(entry => entry.id === gameId);
  expect(game, `Arcade catalogue entry ${gameId}`).toBeDefined();
  await expect(page.getByRole("heading", { name: game!.title, exact: true })).toBeVisible();
  await expect(page.locator(".arcade-topbar")).toContainText(`ROOM ${code}`);
  await expect(page.getByRole("button", { name: "Start Game", exact: true })).toBeEnabled();
}
