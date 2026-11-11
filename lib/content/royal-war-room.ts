import { deterministicShuffle } from "../game/random";

export type WarCampaign = "ATTACK" | "DEFEND";

export interface WarScenario {
  id: string;
  campaign: WarCampaign;
  chapter: 1 | 2 | 3;
  title: string;
  prompt: string;
  choices: Array<{ id: string; label: string }>;
}

const scenarios: WarScenario[] = [
  { id: "attack-prep-1", campaign: "ATTACK", chapter: 1, title: "Prepare the Takeover", prompt: "What should our kingdom prepare first to conquer the neighbouring castle?", choices: [
    { id: "dragon", label: "Recruit a dragon with questionable references" }, { id: "gatekeeper", label: "Bribe the enemy gatekeeper with premium cheese" }, { id: "maps", label: "Replace their maps with children’s drawings" }, { id: "geese", label: "Train armoured geese to march in formation" }, { id: "decoy", label: "Build a full-sized wooden decoy castle" }, { id: "ghost", label: "Spread a rumour that their castle is haunted" },
  ] },
  { id: "attack-prep-2", campaign: "ATTACK", chapter: 1, title: "Assemble the Campaign", prompt: "Which part of our extremely official invasion plan deserves priority?", choices: [
    { id: "wizard", label: "Hire a wizard who only works weekends" }, { id: "uniforms", label: "Design intimidating but breathable uniforms" }, { id: "tunnel", label: "Dig a tunnel and hope it reaches the right castle" }, { id: "caterer", label: "Book a caterer for the victory banquet" }, { id: "spy", label: "Send Aunt Hilda undercover as a tapestry seller" }, { id: "anthem", label: "Write a catchy invasion anthem" },
  ] },
  { id: "attack-breach-1", campaign: "ATTACK", chapter: 2, title: "Breach the Castle", prompt: "Put our attack actions in the order the room wants them attempted.", choices: [
    { id: "letter", label: "Catapult a very polite warning letter" }, { id: "kitchen", label: "Sneak in through the royal kitchen" }, { id: "soup", label: "Distract the guards with unlimited soup" }, { id: "karaoke", label: "Challenge their strongest knight to karaoke" }, { id: "inspectors", label: "Walk through the gate dressed as inspectors" }, { id: "giftshop", label: "Tunnel directly into the castle gift shop" },
  ] },
  { id: "attack-breach-2", campaign: "ATTACK", chapter: 2, title: "Launch the Siege", prompt: "How should this magnificent disaster of an invasion unfold?", choices: [
    { id: "bees", label: "Release ten thousand unionized bees" }, { id: "pigeon", label: "Send the pigeon with forged surrender papers" }, { id: "bull", label: "Ram the gate with an enormous wooden bull" }, { id: "laundry", label: "Hide the army in the royal laundry delivery" }, { id: "moat", label: "Drain the moat using one suspicious straw" }, { id: "grandmother", label: "Let one persuasive grandmother negotiate" },
  ] },
  { id: "attack-rule-1", campaign: "ATTACK", chapter: 3, title: "Rule the New Kingdom", prompt: "After taking the castle, what should the new rulers change first?", choices: [
    { id: "flag", label: "Replace the enemy flag before anyone notices" }, { id: "bear", label: "Appoint a bear as Royal Treasurer" }, { id: "spa", label: "Convert the dungeon into a luxury spa" }, { id: "nap", label: "Introduce mandatory afternoon naps" }, { id: "pigeonhero", label: "Declare the pigeon a national hero" }, { id: "name", label: "Rename the kingdom something marketable" },
  ] },
  { id: "attack-rule-2", campaign: "ATTACK", chapter: 3, title: "Secure the Crown", prompt: "What must happen first now that we somehow own another castle?", choices: [
    { id: "keys", label: "Find out who actually has the castle keys" }, { id: "portrait", label: "Commission an unnecessarily heroic portrait" }, { id: "laws", label: "Replace every law with a shorter law" }, { id: "guards", label: "Convince the old guards this was their idea" }, { id: "moatparty", label: "Hold a victory party in the moat" }, { id: "apology", label: "Draft an apology to the neighbouring kingdoms" },
  ] },
  { id: "defend-warning-1", campaign: "DEFEND", chapter: 1, title: "Sound the Alarm", prompt: "Scouts spotted an invasion. What should our castle do first?", choices: [
    { id: "gate", label: "Close the gate and locate its missing lock" }, { id: "dragon", label: "Wake the dragon using a very long stick" }, { id: "villagers", label: "Move the villagers somewhere less flammable" }, { id: "pigeon", label: "Send the pigeon for reinforcements" }, { id: "food", label: "Hide the emergency cheese reserves" }, { id: "king", label: "Explain the situation to the King using puppets" },
  ] },
  { id: "defend-warning-2", campaign: "DEFEND", chapter: 1, title: "Raise the Defences", prompt: "Which defensive preparation deserves immediate royal attention?", choices: [
    { id: "moat", label: "Refill the moat with something intimidating" }, { id: "walls", label: "Check whether the decorative walls are structural" }, { id: "wizard", label: "Interrupt the wizard’s scheduled day off" }, { id: "decoy", label: "Build a decoy King from bread" }, { id: "bells", label: "Ring every bell and hope one means invasion" }, { id: "tunnel", label: "Block the secret tunnel everyone knows about" },
  ] },
  { id: "defend-siege-1", campaign: "DEFEND", chapter: 2, title: "Hold the Castle", prompt: "Put our defensive actions in the order the room trusts most.", choices: [
    { id: "soup", label: "Pour confusingly warm soup from the walls" }, { id: "geese", label: "Deploy the castle’s tactical geese" }, { id: "bridge", label: "Raise the drawbridge halfway and jiggle it" }, { id: "speech", label: "Give the invaders a painfully long welcome speech" }, { id: "bees", label: "Release the emergency bees" }, { id: "sign", label: "Hang a sign saying WRONG CASTLE" },
  ] },
  { id: "defend-siege-2", campaign: "DEFEND", chapter: 2, title: "Survive the Siege", prompt: "How should the defenders respond as the enemy reaches the walls?", choices: [
    { id: "boulders", label: "Roll decorative boulders toward the gate" }, { id: "band", label: "Make the royal band play something threatening" }, { id: "cake", label: "Offer the enemy an obviously suspicious cake" }, { id: "knights", label: "Wake whichever knights are still employed" }, { id: "mirror", label: "Use mirrors to make the army look twice as large" }, { id: "mother", label: "Ask the invading King’s mother to call him" },
  ] },
  { id: "defend-counter-1", campaign: "DEFEND", chapter: 3, title: "Turn the Battle", prompt: "The invaders are wavering. What should our counterattack do first?", choices: [
    { id: "banner", label: "Capture their banner and wear it as a cape" }, { id: "supplies", label: "Replace their supplies with turnips" }, { id: "general", label: "Challenge their general to a board game" }, { id: "horses", label: "Convince their horses the war is cancelled" }, { id: "camp", label: "Move their entire camp two feet left" }, { id: "crown", label: "Steal their spare Crown while everyone argues" },
  ] },
  { id: "defend-counter-2", campaign: "DEFEND", chapter: 3, title: "Send Them Home", prompt: "How should the castle finish this defensive masterpiece?", choices: [
    { id: "invoice", label: "Invoice the invaders for wall damage" }, { id: "rumour", label: "Spread a rumour that their own castle is unguarded" }, { id: "parade", label: "Stage a victory parade before winning" }, { id: "wizard", label: "Let the wizard try the spell labelled probably" }, { id: "pigeons", label: "Drop surrender forms from a flock of pigeons" }, { id: "gate", label: "Open the gate and act strangely confident" },
  ] },
];

export function warScenario(campaign: WarCampaign, chapter: 1 | 2 | 3, seed: string, matchNumber: number): WarScenario {
  const pool = scenarios.filter((item) => item.campaign === campaign && item.chapter === chapter);
  return deterministicShuffle(pool, `${seed}:${campaign}:${chapter}`)[(matchNumber - 1) % pool.length];
}

export function campaignForMatch(matchNumber: number): WarCampaign { return matchNumber % 2 === 1 ? "ATTACK" : "DEFEND"; }

