// Original, concrete ideas: no trivia, named celebrities or abstract phrases.
export const DRAWING_PROMPTS = [
  "Cat in a hat", "Robot dancing", "Dog with a ball",
  "Fish in a bowl", "Smiling sun", "Sleepy moon", "Flying kite", "Ice cream cone",
  "Rocket ship", "Snowman with a scarf", "Penguin with a balloon", "Rabbit eating a carrot",
  "Duck in a puddle", "Bird in a nest", "Frog on a leaf", "Turtle racing",
  "Pizza with sunglasses", "Pumpkin with a face", "Teddy bear", "Treasure chest",
  "Magic wand", "Sleeping dragon", "Happy cloud", "Cow with an umbrella",
  "Person waving", "Person running", "Person dancing", "Dinosaur eating cake",
  "Flower in a boot", "Tree house", "Paper airplane", "Boat on a lake",
  "Bear on a bike", "Mouse eating cheese", "Crab on a beach", "Octopus with a hat",
  "Cup of hot chocolate", "Birthday cake", "Castle with a flag", "Bee on a flower",
  "Apple with a worm", "Monster with one eye", "Snail with a crown", "Banana in a shoe",
  "Giraffe with a bow", "Elephant with a balloon", "Cactus in a pot", "Basket of apples",
] as const;
export const DEFAULT_DRAWING_PROMPTS = DRAWING_PROMPTS.slice(0, 3);

export function nextDrawingPrompts(previous: readonly string[], random: () => number = Math.random): string[] {
  const available = DRAWING_PROMPTS.filter((item) => !previous.includes(item));
  const choices: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const pick = Math.max(0, Math.min(available.length - 1, Math.floor(random() * available.length)));
    choices.push(available.splice(pick, 1)[0]);
  }
  return choices;
}
