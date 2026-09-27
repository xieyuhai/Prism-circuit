export type Phase = "ready" | "playing" | "paused" | "won";
export type TileKind = "straight" | "elbow";

export interface Tile {
    x: number;
    y: number;
    kind: TileKind;
    rotation: number;
    target: number;
    path: boolean;
}

export interface Point { x: number; y: number; }

export interface GameUIModel {
    phase: Phase;
    level: number;
    size: number;
    entryRow: number;
    exitRow: number;
    tiles: Tile[];
    beam: Point[];
    beamComplete: boolean;
    guide: Point | null;
    moves: number;
    par: number;
    stars: number;
    bestStars: number;
    elapsed: number;
    hintUsed: boolean;
    pulse: number;
}
