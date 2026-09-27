"use strict";
(function () {
const definitions = Object.create(null);
const modules = Object.create(null);
function define(id, dependencies, factory) { definitions[id] = { dependencies, factory }; }
function requireModule(id) {
  if (modules[id]) return modules[id];
  const definition = definitions[id];
  if (!definition) throw new Error("Missing module: " + id);
  const exports = modules[id] = {};
  const args = definition.dependencies.map(name => name === "exports" ? exports : name === "require" ? requireModule : requireModule(name));
  definition.factory.apply(null, args);
  return exports;
}
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define("model/GameModels", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("repository/ProgressRepository", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProgressRepository = void 0;
    class ProgressRepository {
        constructor() {
            this.key = "prism-circuit.progress.v2";
        }
        read() {
            var _a, _b;
            try {
                const raw = (_b = (_a = this.wechat()) === null || _a === void 0 ? void 0 : _a.getStorageSync(this.key)) !== null && _b !== void 0 ? _b : localStorage.getItem(this.key);
                const value = JSON.parse(String(raw || "{}"));
                if (!value || typeof value !== "object" || Array.isArray(value))
                    return {};
                const result = {};
                for (const [key, stars] of Object.entries(value)) {
                    if (/^[1-9]\d{0,3}$/.test(key) && Number.isInteger(stars) && stars >= 1 && stars <= 3)
                        result[key] = stars;
                }
                return result;
            }
            catch (_c) {
                return {};
            }
        }
        save(progress) {
            try {
                const value = JSON.stringify(progress);
                const wx = this.wechat();
                if (wx)
                    wx.setStorageSync(this.key, value);
                else
                    localStorage.setItem(this.key, value);
            }
            catch ( /* Local progress is optional. */_a) { /* Local progress is optional. */ }
        }
        wechat() {
            return globalThis.wx;
        }
    }
    exports.ProgressRepository = ProgressRepository;
});
define("viewmodel/GameViewModel", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GameViewModel = void 0;
    const DX = [0, 1, 0, -1];
    const DY = [-1, 0, 1, 0];
    class GameViewModel {
        constructor(repository) {
            this.repository = repository;
            this.phase = "ready";
            this.level = 1;
            this.size = 4;
            this.entryRow = 1;
            this.exitRow = 1;
            this.tiles = [];
            this.pathOrder = [];
            this.beam = [];
            this.beamComplete = false;
            this.moves = 0;
            this.par = 0;
            this.elapsed = 0;
            this.hintUsed = false;
            this.pulse = 0;
            this.listener = () => { };
            this.progress = repository.read();
            this.level = Math.max(1, ...Object.keys(this.progress).map(Number)) + (Object.keys(this.progress).length ? 1 : 0);
            this.createLevel();
        }
        subscribe(listener) { this.listener = listener; this.emit(); }
        start() {
            if (this.phase === "paused") {
                this.phase = "playing";
                this.emit();
                return;
            }
            if (this.phase === "playing")
                return;
            this.phase = "playing";
            this.emit();
        }
        pause() { if (this.phase === "playing") {
            this.phase = "paused";
            this.emit();
        } }
        togglePause() {
            if (this.phase === "playing")
                this.phase = "paused";
            else if (this.phase === "paused")
                this.phase = "playing";
            else
                return;
            this.emit();
        }
        rotate(x, y) {
            if (this.phase !== "playing" || x < 0 || x >= this.size || y < 0 || y >= this.size)
                return;
            const tile = this.tiles[y * this.size + x];
            tile.rotation = (tile.rotation + 1) % (tile.kind === "straight" ? 2 : 4);
            this.moves++;
            this.pulse = 0.35;
            this.retrace();
            if (this.beamComplete)
                this.win();
            this.emit();
        }
        hint() {
            if (this.phase !== "playing" || this.hintUsed)
                return;
            const tile = this.pathOrder.map(index => this.tiles[index]).find(t => t.rotation !== t.target);
            if (!tile)
                return;
            tile.rotation = tile.target;
            this.hintUsed = true;
            this.moves += 2;
            this.pulse = 0.75;
            this.retrace();
            if (this.beamComplete)
                this.win();
            this.emit();
        }
        restart() { this.createLevel(); this.phase = "playing"; this.emit(); }
        nextLevel() {
            if (this.phase !== "won")
                return;
            this.level++;
            this.createLevel();
            this.phase = "playing";
            this.emit();
        }
        update(dt) {
            if (this.phase !== "playing")
                return;
            this.elapsed += dt;
            this.pulse = Math.max(0, this.pulse - dt);
            this.emit();
        }
        createLevel() {
            var _a, _b;
            if (this.level === 1) {
                this.createTutorialLevel();
                return;
            }
            const random = this.random(this.level * 71237 + 917);
            this.size = this.level < 3 ? 4 : this.level < 8 ? 5 : 6;
            this.entryRow = Math.floor(this.size / 2);
            let row = this.entryRow;
            const path = new Map();
            this.pathOrder = [];
            const put = (x, y, kind, rotation) => {
                const index = y * this.size + x;
                path.set(index, { kind, rotation });
                this.pathOrder.push(index);
            };
            for (let x = 0; x < this.size; x++) {
                const choices = [-2, -1, 0, 1, 2].filter(d => row + d >= 0 && row + d < this.size);
                const shift = choices[Math.floor(random() * choices.length)];
                const next = row + shift;
                if (shift === 0)
                    put(x, row, "straight", 0);
                else {
                    put(x, row, "elbow", shift > 0 ? 2 : 3);
                    const step = Math.sign(shift);
                    for (let y = row + step; y !== next; y += step)
                        put(x, y, "straight", 1);
                    put(x, next, "elbow", shift > 0 ? 0 : 1);
                }
                row = next;
            }
            this.exitRow = row;
            this.tiles = [];
            this.par = 0;
            for (let y = 0; y < this.size; y++)
                for (let x = 0; x < this.size; x++) {
                    const route = path.get(y * this.size + x);
                    const kind = (_a = route === null || route === void 0 ? void 0 : route.kind) !== null && _a !== void 0 ? _a : (random() < 0.54 ? "elbow" : "straight");
                    const limit = kind === "straight" ? 2 : 4;
                    const target = (_b = route === null || route === void 0 ? void 0 : route.rotation) !== null && _b !== void 0 ? _b : Math.floor(random() * limit);
                    const offset = route
                        ? (random() < (this.level < 8 ? 0.6 : 0.8) ? limit - 1 : 0)
                        : Math.floor(random() * limit);
                    const rotation = (target + offset) % limit;
                    if (route)
                        this.par += (target - rotation + limit) % limit;
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
                if (first.kind === "elbow" && first.target === 0)
                    first.rotation = 1;
                this.retrace();
            }
        }
        createTutorialLevel() {
            var _a, _b;
            this.size = 3;
            this.entryRow = 1;
            this.exitRow = 1;
            const route = [
                { x: 0, y: 1, kind: "elbow", target: 2 },
                { x: 0, y: 2, kind: "elbow", target: 0 },
                { x: 1, y: 2, kind: "elbow", target: 3 },
                { x: 1, y: 1, kind: "elbow", target: 1 },
                { x: 2, y: 1, kind: "straight", target: 0 }
            ];
            this.pathOrder = route.map(t => t.y * this.size + t.x);
            this.tiles = [];
            for (let y = 0; y < this.size; y++)
                for (let x = 0; x < this.size; x++) {
                    const piece = route.find(t => t.x === x && t.y === y);
                    const kind = (_a = piece === null || piece === void 0 ? void 0 : piece.kind) !== null && _a !== void 0 ? _a : (x === y ? "straight" : "elbow");
                    const target = (_b = piece === null || piece === void 0 ? void 0 : piece.target) !== null && _b !== void 0 ? _b : 0;
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
        connections(tile) {
            if (tile.kind === "straight")
                return tile.rotation % 2 === 0 ? [1, 3] : [0, 2];
            return [tile.rotation, (tile.rotation + 1) % 4];
        }
        retrace() {
            let x = 0, y = this.entryRow, incoming = 3;
            this.beam = [{ x: -0.5, y: this.entryRow }];
            this.beamComplete = false;
            const seen = new Set();
            for (let i = 0; i < this.size * this.size * 4; i++) {
                if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
                    if (x === this.size && y === this.exitRow) {
                        this.beam.push({ x: this.size - 0.5, y });
                        this.beamComplete = true;
                    }
                    return;
                }
                const key = `${x},${y},${incoming}`;
                if (seen.has(key))
                    return;
                seen.add(key);
                const tile = this.tiles[y * this.size + x];
                const [a, b] = this.connections(tile);
                if (a !== incoming && b !== incoming)
                    return;
                this.beam.push({ x, y });
                const out = a === incoming ? b : a;
                x += DX[out];
                y += DY[out];
                incoming = (out + 2) % 4;
            }
        }
        win() {
            this.phase = "won";
            const stars = this.stars();
            if (stars > (this.progress[String(this.level)] || 0)) {
                this.progress[String(this.level)] = stars;
                this.repository.save(this.progress);
            }
        }
        stars() {
            if (this.hintUsed)
                return this.moves <= this.par + 5 ? 2 : 1;
            return this.moves <= this.par ? 3 : this.moves <= this.par + 5 ? 2 : 1;
        }
        emit() {
            this.listener({ phase: this.phase, level: this.level, size: this.size,
                entryRow: this.entryRow, exitRow: this.exitRow, tiles: this.tiles,
                beam: this.beam, beamComplete: this.beamComplete,
                guide: this.level === 1 ? this.tutorialGuide() : null, moves: this.moves,
                par: this.par, stars: this.phase === "won" ? this.stars() : 0,
                bestStars: this.progress[String(this.level)] || 0,
                elapsed: this.elapsed, hintUsed: this.hintUsed, pulse: this.pulse });
        }
        random(seed) {
            return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        }
        tutorialGuide() {
            const tile = this.pathOrder.map(index => this.tiles[index]).find(t => t.rotation !== t.target);
            return tile ? { x: tile.x, y: tile.y } : null;
        }
    }
    exports.GameViewModel = GameViewModel;
});
define("config/zh_CN", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.zhCN = void 0;
    exports.zhCN = {
        title: "棱镜回路", englishTitle: "PRISM CIRCUIT", subtitle: "转动光路，点亮沉睡的星核",
        start: "开始点亮", resume: "继续解谜", next: "进入下一关", pause: "暂停",
        restart: "重置", hint: "提示", hintUsed: "已使用", level: "关卡", moves: "步数",
        par: "参考", seconds: "秒", best: "最佳", stars: "星", guide: "轻点模块旋转  ·  连通光束与星核",
        tip: "每一关都是新的光路，尽量用更少步数完成", won: "星核已点亮",
        tutorial: "跟着发光边框点，每块转一次就能接通",
        wonTip: "光路闭合，下一片星域正在等待", pauseTitle: "光暂停了",
        progress: "已保存本机关卡进度", resetTip: "重置当前关卡", hintTip: "自动校准一块光路，最高获得两星",
        brand: "A SMALL UNIVERSE IN YOUR HANDS", score3: "完美光路", score2: "漂亮的解法", score1: "成功接通",
        keyboardTip: "电脑可用鼠标操作，空格暂停", newLevel: "新星域"
    };
});
define("page/GamePage", ["require", "exports", "config/zh_CN"], function (require, exports, zh_CN_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GamePage = void 0;
    const C = {
        night: "#080e2a", navy: "#111b3e", panel: "#182346", edge: "#607093",
        cyan: "#7ef6e5", glow: "#37d9db", coral: "#ffb1a1", cream: "#f9edce",
        muted: "#a8b7cb", purple: "#9b85dc", tile: "#273657", tileAlt: "#304366"
    };
    const BOARD_X = 60;
    const BOARD_Y = 340;
    const BOARD_SIZE = 600;
    class GamePage {
        constructor(scene, actions) {
            this.scene = scene;
            this.actions = actions;
            this.background = new Laya.Sprite();
            this.board = new Laya.Sprite();
            this.beam = new Laya.Sprite();
            this.hud = new Laya.Sprite();
            this.overlay = new Laya.Sprite();
            this.levelText = this.text("", 54, 158, 28, C.cream, true, 250);
            this.movesText = this.text("", 325, 203, 25, C.cream, true, 250, "right");
            this.statusText = this.text("", 70, 969, 25, C.muted, false, 580, "center");
            this.hintButton = new Laya.Sprite();
            this.resetButton = new Laya.Sprite();
            this.pauseButton = new Laya.Sprite();
            this.overlayTitle = this.text("", 65, 491, 69, C.cream, true, 590, "center");
            this.overlaySubtitle = this.text("", 84, 593, 26, C.muted, false, 552, "center");
            this.overlayResult = this.text("", 70, 688, 32, C.cyan, true, 580, "center");
            this.primaryLabel = this.text("", 0, 21, 32, C.night, true, 490, "center");
            this.primaryButton = new Laya.Sprite();
            this.replayButton = new Laya.Sprite();
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
        dispose() { Laya.stage.off(Laya.Event.CLICK, this, this.onBoardClick); }
        render(state) {
            this.latest = state;
            this.drawBoard(state);
            this.drawBeam(state);
            this.levelText.text = `${zh_CN_1.zhCN.level}  ${String(state.level).padStart(2, "0")}`;
            this.movesText.text = `${zh_CN_1.zhCN.moves} ${state.moves}  /  ${zh_CN_1.zhCN.par} ${state.par}`;
            this.statusText.text = state.phase === "playing" ? (state.level === 1 ? zh_CN_1.zhCN.tutorial : zh_CN_1.zhCN.guide) : zh_CN_1.zhCN.tip;
            this.overlay.visible = state.phase !== "playing";
            this.pauseButton.visible = state.phase === "playing";
            this.hintButton.alpha = state.hintUsed ? 0.48 : 1;
            this.replayButton.visible = state.phase === "won";
            if (state.phase === "ready") {
                this.overlayTitle.text = zh_CN_1.zhCN.title;
                this.overlaySubtitle.text = zh_CN_1.zhCN.subtitle;
                this.overlayResult.text = `${zh_CN_1.zhCN.level} ${String(state.level).padStart(2, "0")}  ·  ${zh_CN_1.zhCN.newLevel}`;
                this.primaryLabel.text = zh_CN_1.zhCN.start;
            }
            else if (state.phase === "paused") {
                this.overlayTitle.text = zh_CN_1.zhCN.pauseTitle;
                this.overlaySubtitle.text = zh_CN_1.zhCN.keyboardTip;
                this.overlayResult.text = `${zh_CN_1.zhCN.moves} ${state.moves}  ·  ${Math.floor(state.elapsed)} ${zh_CN_1.zhCN.seconds}`;
                this.primaryLabel.text = zh_CN_1.zhCN.resume;
            }
            else if (state.phase === "won") {
                this.overlayTitle.text = zh_CN_1.zhCN.won;
                this.overlaySubtitle.text = zh_CN_1.zhCN.wonTip;
                this.overlayResult.text = `${"★ ".repeat(state.stars)}   ${state.stars === 3 ? zh_CN_1.zhCN.score3 : state.stars === 2 ? zh_CN_1.zhCN.score2 : zh_CN_1.zhCN.score1}`;
                this.primaryLabel.text = zh_CN_1.zhCN.next;
            }
        }
        onBoardClick(event) {
            if (!this.latest || this.latest.phase !== "playing")
                return;
            const cell = BOARD_SIZE / this.latest.size;
            const x = Math.floor((Laya.stage.mouseX - BOARD_X) / cell);
            const y = Math.floor((Laya.stage.mouseY - BOARD_Y) / cell);
            if (x >= 0 && x < this.latest.size && y >= 0 && y < this.latest.size)
                this.actions.rotate(x, y);
        }
        drawBackground() {
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
        buildHud() {
            this.hud.addChild(this.text(zh_CN_1.zhCN.englishTitle, 52, 49, 20, C.cyan, true, 405));
            this.hud.addChild(this.text(zh_CN_1.zhCN.title, 51, 78, 62, C.cream, true, 460));
            this.hud.addChild(this.levelText);
            this.hud.addChild(this.movesText);
            this.hud.addChild(this.statusText);
            this.makeButton(this.resetButton, 50, 1062, 288, 111, zh_CN_1.zhCN.restart, "#34466a", C.cream, () => this.actions.restart());
            this.makeButton(this.hintButton, 382, 1062, 288, 111, zh_CN_1.zhCN.hint, "#a1e7d6", C.night, () => this.actions.hint());
            this.pauseButton.pos(592, 162);
            this.pauseButton.size(65, 55);
            this.pauseButton.graphics.drawRoundRect(0, 0, 65, 55, 16, 16, 16, 16, C.tile, C.edge, 2);
            this.pauseButton.addChild(this.text("Ⅱ", 0, 11, 25, C.cream, true, 65, "center"));
            this.pauseButton.on(Laya.Event.CLICK, this, (e) => { e.stopPropagation(); this.actions.pause(); });
            this.hud.addChild(this.pauseButton);
            this.hud.addChild(this.text(zh_CN_1.zhCN.progress, 70, 1201, 17, C.muted, false, 580, "center"));
        }
        makeButton(button, x, y, w, h, label, fill, ink, onClick) {
            button.pos(x, y);
            button.size(w, h);
            button.graphics.drawRoundRect(0, 0, w, h, 28, 28, 28, 28, fill, C.edge, 2);
            button.addChild(this.text(label, 0, 32, 31, ink, true, w, "center"));
            button.on(Laya.Event.CLICK, this, (e) => { e.stopPropagation(); onClick(); });
            this.hud.addChild(button);
        }
        buildOverlay() {
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
            this.primaryButton.on(Laya.Event.CLICK, this, (e) => {
                e.stopPropagation();
                if (this.latest.phase === "won")
                    this.actions.next();
                else
                    this.actions.start();
            });
            panel.addChild(this.primaryButton);
            this.replayButton.pos(260, 899);
            this.replayButton.size(200, 48);
            this.replayButton.addChild(this.text(zh_CN_1.zhCN.restart, 0, 7, 23, C.muted, false, 200, "center"));
            this.replayButton.on(Laya.Event.CLICK, this, (e) => { e.stopPropagation(); this.actions.restart(); });
            panel.addChild(this.replayButton);
            this.overlay.addChild(panel);
            this.overlay.addChild(this.text(zh_CN_1.zhCN.brand, 75, 1185, 16, C.muted, true, 570, "center"));
        }
        drawBoard(state) {
            var _a, _b;
            const g = this.board.graphics;
            g.clear();
            const cell = BOARD_SIZE / state.size;
            g.drawRoundRect(39, 319, 642, 642, 28, 28, 28, 28, "#101a38", "#6a79a0", 3);
            g.drawRoundRect(BOARD_X - 5, BOARD_Y - 5, 610, 610, 18, 18, 18, 18, "#1a2849", "#364c75", 2);
            for (const tile of state.tiles)
                this.drawTile(g, tile, cell, state.elapsed, ((_a = state.guide) === null || _a === void 0 ? void 0 : _a.x) === tile.x && ((_b = state.guide) === null || _b === void 0 ? void 0 : _b.y) === tile.y);
            const inputY = BOARD_Y + (state.entryRow + 0.5) * cell;
            const outputY = BOARD_Y + (state.exitRow + 0.5) * cell;
            g.drawCircle(34, inputY, 27, "#1b546a", C.cyan, 3);
            g.drawCircle(34, inputY, 15, C.cyan);
            g.drawCircle(686, outputY, 31, state.beamComplete ? "#598d95" : "#354365", C.coral, 3);
            g.drawPoly(686, outputY, [0, -18, 15, 0, 0, 18, -15, 0], state.beamComplete ? C.cream : C.coral);
        }
        drawTile(g, tile, cell, time, guided) {
            const x = BOARD_X + tile.x * cell;
            const y = BOARD_Y + tile.y * cell;
            const cx = x + cell / 2;
            const cy = y + cell / 2;
            const inset = cell * 0.045;
            g.drawRoundRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2, 16, 16, 16, 16, (tile.x + tile.y) % 2 ? C.tile : C.tileAlt, "#50638a", 1.5);
            if (guided) {
                const border = 7 + Math.sin(time * 7) * 2;
                g.drawRoundRect(x + inset + 3, y + inset + 3, cell - inset * 2 - 6, cell - inset * 2 - 6, 14, 14, 14, 14, null, C.coral, border);
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
        drawBeam(state) {
            const g = this.beam.graphics;
            g.clear();
            const cell = BOARD_SIZE / state.size;
            const project = (p) => ({ x: BOARD_X + (p.x + 0.5) * cell, y: BOARD_Y + (p.y + 0.5) * cell });
            const points = state.beam.map(project);
            if (points.length < 2)
                return;
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
        text(value, x, y, size, color, bold = false, width = 180, align = "left") {
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
    exports.GamePage = GamePage;
    function statePulse(time, x, y) {
        return Math.sin(time * 2.3 + x * 0.8 + y * 0.6);
    }
});
define("Main", ["require", "exports", "viewmodel/GameViewModel", "repository/ProgressRepository", "page/GamePage"], function (require, exports, GameViewModel_1, ProgressRepository_1, GamePage_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Main = void 0;
    const { regClass } = Laya;
    let Main = class Main extends Laya.Script {
        constructor() {
            super(...arguments);
            this.onVisibility = () => { if (document.hidden)
                this.viewModel.pause(); };
            this.onWechatHide = () => this.viewModel.pause();
        }
        onStart() {
            var _a;
            Laya.stage.designWidth = 720;
            Laya.stage.designHeight = 1280;
            Laya.stage.scaleMode = Laya.Stage.SCALE_SHOWALL;
            Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
            Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
            Laya.stage.bgColor = "#080e2a";
            Laya.stage.updateCanvasSize();
            this.viewModel = new GameViewModel_1.GameViewModel(new ProgressRepository_1.ProgressRepository());
            this.page = new GamePage_1.GamePage(this.owner, {
                start: () => this.viewModel.start(), pause: () => this.viewModel.togglePause(),
                rotate: (x, y) => this.viewModel.rotate(x, y), hint: () => this.viewModel.hint(),
                restart: () => this.viewModel.restart(), next: () => this.viewModel.nextLevel()
            });
            this.viewModel.subscribe(state => this.page.render(state));
            Laya.stage.on(Laya.Event.KEY_DOWN, this, this.handleKeyDown);
            if (typeof document !== "undefined")
                document.addEventListener("visibilitychange", this.onVisibility);
            (_a = this.wechat()) === null || _a === void 0 ? void 0 : _a.onHide(this.onWechatHide);
            Laya.timer.frameLoop(1, this, this.tick);
        }
        tick() { this.viewModel.update(Math.min(Laya.timer.delta / 1000, 0.05)); }
        handleKeyDown(event) {
            const key = String(event.key || "").toLowerCase();
            if (key === " " || key === "escape" || key === "p")
                this.viewModel.togglePause();
            else if (key === "enter")
                this.viewModel.start();
        }
        wechat() {
            return globalThis.wx;
        }
        onDestroy() {
            var _a, _b, _c;
            Laya.timer.clear(this, this.tick);
            Laya.stage.off(Laya.Event.KEY_DOWN, this, this.handleKeyDown);
            if (typeof document !== "undefined")
                document.removeEventListener("visibilitychange", this.onVisibility);
            (_b = (_a = this.wechat()) === null || _a === void 0 ? void 0 : _a.offHide) === null || _b === void 0 ? void 0 : _b.call(_a, this.onWechatHide);
            (_c = this.page) === null || _c === void 0 ? void 0 : _c.dispose();
        }
    };
    Main = __decorate([
        regClass("JN2PIJXETvSv+XlElFvreA")
    ], Main);
    exports.Main = Main;
});

requireModule("Main");
})();
