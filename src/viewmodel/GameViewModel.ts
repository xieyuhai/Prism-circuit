import { GameUIModel, Phase, Point, Tile, TileKind } from "../model/GameModels";
import { ProgressRepository } from "../repository/ProgressRepository";

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export class GameViewModel {
    private phase: Phase = "ready";
    private level = 1;
    private size = 4;
    private entryRow = 1;
    private exitRow = 1;
    private tiles: Tile[] = [];
    private pathOrder: number[] = [];
    private beam: Point[] = [];
    private beamComplete = false;
    private moves = 0;
    private par = 0;
    private elapsed = 0;
    private hintUsed = false;
    private pulse = 0;
    private progress: Record<string, number>;
    private listener: (state: GameUIModel) => void = () => {};

    constructor(private readonly repository: ProgressRepository) {
        this.progress = repository.read();
        this.level = Math.max(1, ...Object.keys(this.progress).map(Number)) + (Object.keys(this.progress).length ? 1 : 0);
        this.createLevel();
    }

    subscribe(listener: (state: GameUIModel) => void): void { this.listener = listener; this.emit(); }

    start(): void {
        if (this.phase === "paused") { this.phase = "playing"; this.emit(); return; }
        if (this.phase === "playing") return;
        this.phase = "playing";
        this.emit();
    }

    pause(): void { if (this.phase === "playing") { this.phase = "paused"; this.emit(); } }
    togglePause(): void {
        if (this.phase === "playing") this.phase = "paused";
        else if (this.phase === "paused") this.phase = "playing";
        else return;
        this.emit();
    }

    rotate(x: number, y: number): void {
        if (this.phase !== "playing" || x < 0 || x >= this.size || y < 0 || y >= this.size) return;
        const tile = this.tiles[y * this.size + x];
        tile.rotation = (tile.rotation + 1) % (tile.kind === "straight" ? 2 : 4);
        this.moves++;
        this.pulse = 0.35;
        this.retrace();
        if (this.beamComplete) this.win();
        this.emit();
    }

    hint(): void {
        if (this.phase !== "playing" || this.hintUsed) return;
        const tile = this.pathOrder.map(index => this.tiles[index]).find(t => t.rotation !== t.target);
        if (!tile) return;
        tile.rotation = tile.target;
        this.hintUsed = true;
        this.moves += 2;
        this.pulse = 0.75;
        this.retrace();
        if (this.beamComplete) this.win();
        this.emit();
    }

    restart(): void { this.createLevel(); this.phase = "playing"; this.emit(); }
    nextLevel(): void {
        if (this.phase !== "won") return;
        this.level++;
        this.createLevel();
        this.phase = "playing";
        this.emit();
    }

    update(dt: number): void {
        if (this.phase !== "playing") return;
        this.elapsed += dt;
        this.pulse = Math.max(0, this.pulse - dt);
        this.emit();
    }

    private createLevel(): void {
        if (this.level === 1) { this.createTutorialLevel(); return; }
        const random = this.random(this.level * 71237 + 917);
        this.size = this.level < 3 ? 4 : this.level < 8 ? 5 : 6;
        this.entryRow = Math.floor(this.size / 2);
        let row = this.entryRow;
        const path = new Map<number, { kind: TileKind; rotation: number }>();
        this.pathOrder = [];
        const put = (x: number, y: number, kind: TileKind, rotation: number): void => {
            const index = y * this.size + x;
            path.set(index, { kind, rotation });
            this.pathOrder.push(index);
        };
        for (let x = 0; x < this.size; x++) {
            const choices = [-2, -1, 0, 1, 2].filter(d => row + d >= 0 && row + d < this.size);
            const shift = choices[Math.floor(random() * choices.length)];
            const next = row + shift;
            if (shift === 0) put(x, row, "straight", 0);
            else {
                put(x, row, "elbow", shift > 0 ? 2 : 3);
                const step = Math.sign(shift);
                for (let y = row + step; y !== next; y += step) put(x, y, "straight", 1);
                put(x, next, "elbow", shift > 0 ? 0 : 1);
            }
            row = next;
        }
        this.exitRow = row;
        this.tiles = [];
        this.par = 0;
        for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
            const route = path.get(y * this.size + x);
            const kind: TileKind = route?.kind ?? (random() < 0.54 ? "elbow" : "straight");
            const limit = kind === "straight" ? 2 : 4;
            const target = route?.rotation ?? Math.floor(random() * limit);
            const offset = route
                ? (random() < (this.level < 8 ? 0.6 : 0.8) ? limit - 1 : 0)
                : Math.floor(random() * limit);
            const rotation = (target + offset) % limit;
            if (route) this.par += (target - rotation + limit) % limit;
            this.tiles.push({ x, y, kind, rotation, target, path: !!route });
        }
        this.moves = 0;
        this.elapsed = 0;
        this.hintUsed = false;
        this.pulse = 0;
        this.retrace();
        // Alternate routes can occasionally solve a shuffled board; change one entry tile in that case.
        if (this.beamComplete) {
            const first = this.tiles[this.entryRow * this.size];
            first.rotation = first.kind === "straight" ? 1 : 0;
            if (first.kind === "elbow" && first.target === 0) first.rotation = 1;
            this.retrace();
        }
    }

    private createTutorialLevel(): void {
        this.size = 3;
        this.entryRow = 1;
        this.exitRow = 1;
        const route = [
            { x: 0, y: 1, kind: "elbow" as TileKind, target: 2 },
            { x: 0, y: 2, kind: "elbow" as TileKind, target: 0 },
            { x: 1, y: 2, kind: "elbow" as TileKind, target: 3 },
            { x: 1, y: 1, kind: "elbow" as TileKind, target: 1 },
            { x: 2, y: 1, kind: "straight" as TileKind, target: 0 }
        ];
        this.pathOrder = route.map(t => t.y * this.size + t.x);
        this.tiles = [];
        for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
            const piece = route.find(t => t.x === x && t.y === y);
            const kind = piece?.kind ?? (x === y ? "straight" : "elbow");
            const target = piece?.target ?? 0;
            const limit = kind === "straight" ? 2 : 4;
            const rotation = piece ? (target + limit - 1) % limit : (x + y) % limit;
            this.tiles.push({ x, y, kind, rotation, target, path: !!piece });
        }
        this.par = 5;
        this.moves = 0;
        this.elapsed = 0;
        this.hintUsed = false;
        this.pulse = 0;
        this.retrace();
    }

    private connections(tile: Tile): [number, number] {
        if (tile.kind === "straight") return tile.rotation % 2 === 0 ? [1, 3] : [0, 2];
        return [tile.rotation, (tile.rotation + 1) % 4];
    }

    private retrace(): void {
        let x = 0, y = this.entryRow, incoming = 3;
        this.beam = [{ x: -0.5, y: this.entryRow }];
        this.beamComplete = false;
        const seen = new Set<string>();
        for (let i = 0; i < this.size * this.size * 4; i++) {
            if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
                if (x === this.size && y === this.exitRow) {
                    this.beam.push({ x: this.size - 0.5, y });
                    this.beamComplete = true;
                }
                return;
            }
            const key = `${x},${y},${incoming}`;
            if (seen.has(key)) return;
            seen.add(key);
            const tile = this.tiles[y * this.size + x];
            const [a, b] = this.connections(tile);
            if (a !== incoming && b !== incoming) return;
            this.beam.push({ x, y });
            const out = a === incoming ? b : a;
            x += DX[out]; y += DY[out]; incoming = (out + 2) % 4;
        }
    }

    private win(): void {
        this.phase = "won";
        const stars = this.stars();
        if (stars > (this.progress[String(this.level)] || 0)) {
            this.progress[String(this.level)] = stars;
            this.repository.save(this.progress);
        }
    }

    private stars(): number {
        if (this.hintUsed) return this.moves <= this.par + 5 ? 2 : 1;
        return this.moves <= this.par ? 3 : this.moves <= this.par + 5 ? 2 : 1;
    }

    private emit(): void {
        this.listener({ phase: this.phase, level: this.level, size: this.size,
            entryRow: this.entryRow, exitRow: this.exitRow, tiles: this.tiles,
            beam: this.beam, beamComplete: this.beamComplete,
            guide: this.level === 1 ? this.tutorialGuide() : null, moves: this.moves,
            par: this.par, stars: this.phase === "won" ? this.stars() : 0,
            bestStars: this.progress[String(this.level)] || 0,
            elapsed: this.elapsed, hintUsed: this.hintUsed, pulse: this.pulse });
    }

    private random(seed: number): () => number {
        return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    }

    private tutorialGuide(): Point | null {
        const tile = this.pathOrder.map(index => this.tiles[index]).find(t => t.rotation !== t.target);
        return tile ? { x: tile.x, y: tile.y } : null;
    }
}
