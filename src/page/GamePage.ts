import { GameUIModel, Point, Tile } from "../model/GameModels";
import { zhCN } from "../config/zh_CN";

interface Actions {
    start(): void; pause(): void; rotate(x: number, y: number): void;
    hint(): void; restart(): void; next(): void;
}

const C = {
    night: "#080e2a", navy: "#111b3e", panel: "#182346", edge: "#607093",
    cyan: "#7ef6e5", glow: "#37d9db", coral: "#ffb1a1", cream: "#f9edce",
    muted: "#a8b7cb", purple: "#9b85dc", tile: "#273657", tileAlt: "#304366"
} as const;
const BOARD_X = 60;
const BOARD_Y = 340;
const BOARD_SIZE = 600;

export class GamePage {
    private readonly background = new Laya.Sprite();
    private readonly board = new Laya.Sprite();
    private readonly beam = new Laya.Sprite();
    private readonly hud = new Laya.Sprite();
    private readonly overlay = new Laya.Sprite();
    private readonly levelText = this.text("", 54, 158, 28, C.cream, true, 250);
    private readonly movesText = this.text("", 325, 203, 25, C.cream, true, 250, "right");
    private readonly statusText = this.text("", 70, 969, 25, C.muted, false, 580, "center");
    private readonly hintButton = new Laya.Sprite();
    private readonly resetButton = new Laya.Sprite();
    private readonly pauseButton = new Laya.Sprite();
    private readonly overlayTitle = this.text("", 65, 491, 69, C.cream, true, 590, "center");
    private readonly overlaySubtitle = this.text("", 84, 593, 26, C.muted, false, 552, "center");
    private readonly overlayResult = this.text("", 70, 688, 32, C.cyan, true, 580, "center");
    private readonly primaryLabel = this.text("", 0, 21, 32, C.night, true, 490, "center");
    private readonly primaryButton = new Laya.Sprite();
    private readonly replayButton = new Laya.Sprite();
    private latest: GameUIModel;

    constructor(private readonly scene: Laya.Scene, private readonly actions: Actions) {
        scene.addChild(this.background);
        scene.addChild(this.board);
        scene.addChild(this.beam);
        scene.addChild(this.hud);
        scene.addChild(this.overlay);
        this.drawBackground();
        this.buildHud();
        this.buildOverlay();
        Laya.stage.on(Laya.Event.CLICK, this, this.onBoardClick);
    }

    dispose(): void { Laya.stage.off(Laya.Event.CLICK, this, this.onBoardClick); }

    render(state: GameUIModel): void {
        this.latest = state;
        this.drawBoard(state);
        this.drawBeam(state);
        this.levelText.text = `${zhCN.level}  ${String(state.level).padStart(2, "0")}`;
        this.movesText.text = `${zhCN.moves} ${state.moves}  /  ${zhCN.par} ${state.par}`;
        this.statusText.text = state.phase === "playing" ? (state.level === 1 ? zhCN.tutorial : zhCN.guide) : zhCN.tip;
        this.overlay.visible = state.phase !== "playing";
        this.pauseButton.visible = state.phase === "playing";
        this.hintButton.alpha = state.hintUsed ? 0.48 : 1;
        this.replayButton.visible = state.phase === "won";
        if (state.phase === "ready") {
            this.overlayTitle.text = zhCN.title;
            this.overlaySubtitle.text = zhCN.subtitle;
            this.overlayResult.text = `${zhCN.level} ${String(state.level).padStart(2, "0")}  ·  ${zhCN.newLevel}`;
            this.primaryLabel.text = zhCN.start;
        } else if (state.phase === "paused") {
            this.overlayTitle.text = zhCN.pauseTitle;
            this.overlaySubtitle.text = zhCN.keyboardTip;
            this.overlayResult.text = `${zhCN.moves} ${state.moves}  ·  ${Math.floor(state.elapsed)} ${zhCN.seconds}`;
            this.primaryLabel.text = zhCN.resume;
        } else if (state.phase === "won") {
            this.overlayTitle.text = zhCN.won;
            this.overlaySubtitle.text = zhCN.wonTip;
            this.overlayResult.text = `${"★ ".repeat(state.stars)}   ${state.stars === 3 ? zhCN.score3 : state.stars === 2 ? zhCN.score2 : zhCN.score1}`;
            this.primaryLabel.text = zhCN.next;
        }
    }

    private onBoardClick(event: Laya.Event): void {
        if (!this.latest || this.latest.phase !== "playing") return;
        const cell = BOARD_SIZE / this.latest.size;
        const x = Math.floor((Laya.stage.mouseX - BOARD_X) / cell);
        const y = Math.floor((Laya.stage.mouseY - BOARD_Y) / cell);
        if (x >= 0 && x < this.latest.size && y >= 0 && y < this.latest.size)
            this.actions.rotate(x, y);
    }

    private drawBackground(): void {
        const g = this.background.graphics;
        g.drawRect(0, 0, 720, 1280, C.night);
        g.drawCircle(360, 516, 450, "#101a3c");
        g.drawCircle(520, 327, 340, "#162448");
        g.drawCircle(118, 845, 284, "#111b3c");
        for (let i = 0; i < 70; i++) {
            const x = 20 + (i * 137.49) % 680;
            const y = 25 + (i * 221.77) % 1210;
            g.drawCircle(x, y, i % 8 === 0 ? 2.1 : 1, i % 4 === 0 ? "#87b9c9" : "#55648b");
        }
        g.drawCircle(612, 108, 98, null, "#24355d", 2);
        g.drawCircle(612, 108, 70, null, "#334577", 2);
        g.drawCircle(612, 108, 34, "#a58cd0");
        g.drawCircle(598, 95, 12, "#f0c8c6");
        g.drawLine(66, 238, 654, 238, "#40527c", 2);
        g.drawLine(66, 949, 654, 949, "#40527c", 2);
        g.drawRoundRect(28, 25, 664, 198, 30, 30, 30, 30, "#121c3d", "#41517c", 2);
        g.drawRoundRect(28, 1030, 664, 220, 30, 30, 30, 30, "#121c3d", "#41517c", 2);
        g.drawPoly(0, 1280, [0, -93, 71, -159, 140, -113, 234, -203, 309, -126, 405, -178, 515, -99, 624, -176, 720, -91, 720, 0], "#152346");
    }

    private buildHud(): void {
        this.hud.addChild(this.text(zhCN.englishTitle, 52, 49, 20, C.cyan, true, 405));
        this.hud.addChild(this.text(zhCN.title, 51, 78, 62, C.cream, true, 460));
        this.hud.addChild(this.levelText);
        this.hud.addChild(this.movesText);
        this.hud.addChild(this.statusText);
        this.makeButton(this.resetButton, 50, 1062, 288, 111, zhCN.restart, "#34466a", C.cream, () => this.actions.restart());
        this.makeButton(this.hintButton, 382, 1062, 288, 111, zhCN.hint, "#a1e7d6", C.night, () => this.actions.hint());
        this.pauseButton.pos(592, 162);
        this.pauseButton.size(65, 55);
        this.pauseButton.graphics.drawRoundRect(0, 0, 65, 55, 16, 16, 16, 16, C.tile, C.edge, 2);
        this.pauseButton.addChild(this.text("Ⅱ", 0, 11, 25, C.cream, true, 65, "center"));
        this.pauseButton.on(Laya.Event.CLICK, this, (e: Laya.Event) => { e.stopPropagation(); this.actions.pause(); });
        this.hud.addChild(this.pauseButton);
        this.hud.addChild(this.text(zhCN.progress, 70, 1201, 17, C.muted, false, 580, "center"));
    }

    private makeButton(button: Laya.Sprite, x: number, y: number, w: number, h: number,
        label: string, fill: string, ink: string, onClick: () => void): void {
        button.pos(x, y);
        button.size(w, h);
        button.graphics.drawRoundRect(0, 0, w, h, 28, 28, 28, 28, fill, C.edge, 2);
        button.addChild(this.text(label, 0, 32, 31, ink, true, w, "center"));
        button.on(Laya.Event.CLICK, this, (e: Laya.Event) => { e.stopPropagation(); onClick(); });
        this.hud.addChild(button);
    }

    private buildOverlay(): void {
        const dim = new Laya.Sprite();
        dim.graphics.drawRect(0, 0, 720, 1280, "#050a21");
        dim.alpha = 0.81;
        this.overlay.addChild(dim);
        const panel = new Laya.Sprite();
        panel.graphics.drawRoundRect(44, 312, 632, 656, 38, 38, 38, 38, "#172344", "#7487a7", 3);
        panel.graphics.drawRoundRect(60, 328, 600, 624, 30, 30, 30, 30, "#1c2b50", "#384b72", 2);
        panel.graphics.drawLine(113, 645, 607, 645, "#526685", 2);
        panel.graphics.drawCircle(360, 407, 72, null, C.cyan, 3);
        panel.graphics.drawCircle(360, 407, 52, null, C.purple, 5);
        panel.graphics.drawPoly(360, 407, [0, -36, 30, 0, 0, 36, -30, 0], C.cyan);
        panel.graphics.drawPoly(360, 407, [0, -22, 19, 0, 0, 22, -19, 0], C.cream);
        panel.addChild(this.overlayTitle);
        panel.addChild(this.overlaySubtitle);
        panel.addChild(this.overlayResult);
        this.primaryButton.pos(115, 788);
        this.primaryButton.size(490, 94);
        this.primaryButton.graphics.drawRoundRect(0, 0, 490, 94, 30, 30, 30, 30, C.cyan, C.cream, 2);
        this.primaryButton.addChild(this.primaryLabel);
        this.primaryButton.on(Laya.Event.CLICK, this, (e: Laya.Event) => {
            e.stopPropagation();
            if (this.latest.phase === "won") this.actions.next();
            else this.actions.start();
        });
        panel.addChild(this.primaryButton);
        this.replayButton.pos(260, 899);
        this.replayButton.size(200, 48);
        this.replayButton.addChild(this.text(zhCN.restart, 0, 7, 23, C.muted, false, 200, "center"));
        this.replayButton.on(Laya.Event.CLICK, this, (e: Laya.Event) => { e.stopPropagation(); this.actions.restart(); });
        panel.addChild(this.replayButton);
        this.overlay.addChild(panel);
        this.overlay.addChild(this.text(zhCN.brand, 75, 1185, 16, C.muted, true, 570, "center"));
    }

    private drawBoard(state: GameUIModel): void {
        const g = this.board.graphics;
        g.clear();
        const cell = BOARD_SIZE / state.size;
        g.drawRoundRect(39, 319, 642, 642, 28, 28, 28, 28, "#101a38", "#6a79a0", 3);
        g.drawRoundRect(BOARD_X - 5, BOARD_Y - 5, 610, 610, 18, 18, 18, 18, "#1a2849", "#364c75", 2);
        for (const tile of state.tiles)
            this.drawTile(g, tile, cell, state.elapsed, state.guide?.x === tile.x && state.guide?.y === tile.y);
        const inputY = BOARD_Y + (state.entryRow + 0.5) * cell;
        const outputY = BOARD_Y + (state.exitRow + 0.5) * cell;
        g.drawCircle(34, inputY, 27, "#1b546a", C.cyan, 3);
        g.drawCircle(34, inputY, 15, C.cyan);
        g.drawCircle(686, outputY, 31, state.beamComplete ? "#598d95" : "#354365", C.coral, 3);
        g.drawPoly(686, outputY, [0, -18, 15, 0, 0, 18, -15, 0], state.beamComplete ? C.cream : C.coral);
    }

    private drawTile(g: Laya.Graphics, tile: Tile, cell: number, time: number, guided: boolean): void {
        const x = BOARD_X + tile.x * cell;
        const y = BOARD_Y + tile.y * cell;
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const inset = cell * 0.045;
        g.drawRoundRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2,
            16, 16, 16, 16, (tile.x + tile.y) % 2 ? C.tile : C.tileAlt, "#50638a", 1.5);
        if (guided) {
            const border = 7 + Math.sin(time * 7) * 2;
            g.drawRoundRect(x + inset + 3, y + inset + 3, cell - inset * 2 - 6, cell - inset * 2 - 6,
                14, 14, 14, 14, null, C.coral, border);
        }
        g.drawCircle(cx, cy, cell * 0.31, "#1b2a4d", "#5b7097", 2);
        g.drawCircle(cx, cy, cell * 0.23, null, "#3c537d", 2);
        const dirs = tile.kind === "straight" ?
            (tile.rotation % 2 === 0 ? [1, 3] : [0, 2]) : [tile.rotation, (tile.rotation + 1) % 4];
        for (const dir of dirs) {
            const angle = dir * Math.PI / 2 - Math.PI / 2;
            const ex = cx + Math.cos(angle) * cell * 0.38;
            const ey = cy + Math.sin(angle) * cell * 0.38;
            g.drawLine(cx, cy, ex, ey, "#40577d", Math.max(12, cell * 0.14));
            g.drawLine(cx, cy, ex, ey, C.cyan, Math.max(5, cell * 0.07));
            g.drawCircle(ex, ey, cell * 0.045, C.cream);
        }
        g.drawCircle(cx, cy, cell * 0.105, C.cyan);
        g.drawCircle(cx - cell * 0.025, cy - cell * 0.035, cell * 0.03, C.cream);
        if (tile.path && statePulse(time, tile.x, tile.y) > 0.98)
            g.drawCircle(cx, cy, cell * 0.29, null, "#7aa3ad", 1);
    }

    private drawBeam(state: GameUIModel): void {
        const g = this.beam.graphics;
        g.clear();
        const cell = BOARD_SIZE / state.size;
        const project = (p: Point): Point => ({ x: BOARD_X + (p.x + 0.5) * cell, y: BOARD_Y + (p.y + 0.5) * cell });
        const points = state.beam.map(project);
        if (points.length < 2) return;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i];
            g.drawLine(a.x, a.y, b.x, b.y, "#246477", 24 + state.pulse * 20);
            g.drawLine(a.x, a.y, b.x, b.y, C.glow, 11 + state.pulse * 8);
            g.drawLine(a.x, a.y, b.x, b.y, C.cream, 4);
        }
        for (const p of points.slice(1)) {
            g.drawCircle(p.x, p.y, 12, C.glow);
            g.drawCircle(p.x, p.y, 5, C.cream);
        }
        const t = state.elapsed * 2.5;
        const index = Math.floor(t) % (points.length - 1);
        const fraction = t - Math.floor(t);
        const a = points[index], b = points[index + 1];
        const px = a.x + (b.x - a.x) * fraction;
        const py = a.y + (b.y - a.y) * fraction;
        g.drawCircle(px, py, 20, "#2d8290");
        g.drawCircle(px, py, 10, C.cream);
        if (state.beamComplete) {
            const end = points[points.length - 1];
            const r = 27 + Math.sin(state.elapsed * 7) * 5;
            g.drawCircle(end.x, end.y, r, null, C.cream, 4);
        }
    }

    private text(value: string, x: number, y: number, size: number, color: string,
        bold = false, width = 180, align: "left" | "center" | "right" = "left"): Laya.Text {
        const label = new Laya.Text();
        label.text = value;
        label.pos(x, y);
        label.size(width, size + 18);
        label.font = "PingFang SC, Microsoft YaHei, sans-serif";
        label.fontSize = size;
        label.color = color;
        label.bold = bold;
        label.align = align;
        return label;
    }
}

function statePulse(time: number, x: number, y: number): number {
    return Math.sin(time * 2.3 + x * 0.8 + y * 0.6);
}
