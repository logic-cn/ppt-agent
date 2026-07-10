import { CURRENT_DECK_VERSION } from "./deck-schema";

type DeckMigration = (input: unknown) => unknown;

const migrations: Record<number, DeckMigration> = {
  1: migrateV1ToV2,
};

function migrateV1ToV2(input: unknown): unknown {
  const deck = input as Record<string, unknown>;
  if (!deck || typeof deck !== "object") return input;

  const slides = (deck as { slides?: unknown[] }).slides;
  if (!Array.isArray(slides)) return { ...deck, version: CURRENT_DECK_VERSION };

  const migratedSlides = slides.map((slide: unknown) => {
    const s = slide as Record<string, unknown>;
    if (!s || typeof s !== "object") return s;

    const newSlide: Record<string, unknown> = { ...s };

    // v2: 确保每页有 id（v1 某些场景可能缺失）
    if (!newSlide.id || newSlide.id === "") {
      newSlide.id = crypto.randomUUID();
    }

    // v2: 为 items 补 id
    if (Array.isArray(newSlide.items)) {
      newSlide.items = (newSlide.items as Record<string, unknown>[]).map(
        (item) => {
          if (!item.id) return { ...item, id: crypto.randomUUID() };
          return item;
        },
      );
    }

    // v2: 为 bullets 递归补 id
    if (Array.isArray(newSlide.bullets)) {
      newSlide.bullets = addMissingIdsToBullets(
        newSlide.bullets as Record<string, unknown>[],
      );
    }

    return newSlide;
  });

  return {
    ...deck,
    slides: migratedSlides,
    version: CURRENT_DECK_VERSION,
  };
}

function addMissingIdsToBullets(
  bullets: Record<string, unknown>[],
): Record<string, unknown>[] {
  return bullets.map((b) => {
    const bullet: Record<string, unknown> = { ...b };
    if (!bullet.id || bullet.id === "") {
      bullet.id = crypto.randomUUID();
    }
    if (Array.isArray(bullet.children)) {
      bullet.children = addMissingIdsToBullets(
        bullet.children as Record<string, unknown>[],
      );
    }
    return bullet;
  });
}

export function migrateToCurrentDeck(input: unknown): {
  data: unknown;
  migrated: boolean;
  futureVersion: boolean;
} {
  if (!input || typeof input !== "object") {
    return { data: input, migrated: false, futureVersion: false };
  }

  const deck = input as Record<string, unknown>;
  const version = (deck.version as number) || 0;

  // 未知未来版本
  if (version > CURRENT_DECK_VERSION) {
    return { data: input, migrated: false, futureVersion: true };
  }

  if (version === CURRENT_DECK_VERSION) {
    return { data: input, migrated: false, futureVersion: false };
  }

  let current: unknown = input;
  let migrated = false;

  for (let v = version; v < CURRENT_DECK_VERSION; v++) {
    const migrateFn = migrations[v];
    if (migrateFn) {
      current = migrateFn(current);
      migrated = true;
    }
  }

  return { data: current, migrated, futureVersion: false };
}
