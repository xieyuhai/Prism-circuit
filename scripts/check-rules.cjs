#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "prism-rules-"));
try {
    const bundledCompiler = "/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/bin/tsc";
    const compiler = process.env.TSC_BIN || (fs.existsSync(bundledCompiler) ? bundledCompiler : "tsc");
    const build = spawnSync(compiler, ["-p", path.join(root, "tsconfig.json"),
        "--module", "commonjs", "--outDir", temporary, "--sourceMap", "false",
        "--noEmitHelpers", "false"], { stdio: "inherit" });
    if (build.error || build.status !== 0) throw new Error("TypeScript 编译失败");
    const { GameViewModel } = require(path.join(temporary, "viewmodel", "GameViewModel.js"));
    const { ProgressRepository } = require(path.join(temporary, "repository", "ProgressRepository.js"));
    const progress = {};
    const vm = new GameViewModel({ read: () => ({ ...progress }), save: value => Object.assign(progress, value) });
    let state;
    vm.subscribe(value => { state = value; });
    assert.equal(state.phase, "ready");
    assert.equal(state.level, 1);
    assert.equal(state.par, 5);
    assert.deepEqual(state.guide, { x: 0, y: 1 });
    vm.start();
    assert.equal(state.phase, "playing");
    vm.pause();
    const elapsed = state.elapsed;
    vm.update(2);
    assert.equal(state.elapsed, elapsed);
    vm.start();
    vm.hint();
    assert.equal(state.hintUsed, true);
    assert.ok(state.beam.length > 1);
    assert.deepEqual(state.guide, { x: 0, y: 2 });
    const usedMoves = state.moves;
    vm.hint();
    assert.equal(state.moves, usedMoves);
    vm.restart();
    assert.equal(state.hintUsed, false);

    for (let level = 1; level <= 12; level++) {
        assert.equal(state.level, level);
        assert.equal(state.phase, "playing");
        assert.equal(state.beamComplete, false);
        const route = state.tiles.filter(tile => tile.path).map(tile => ({ ...tile }));
        for (const tile of route) {
            if (state.phase === "won") break;
            const limit = tile.kind === "straight" ? 2 : 4;
            const turns = (tile.target - tile.rotation + limit) % limit;
            for (let i = 0; i < turns && state.phase === "playing"; i++) vm.rotate(tile.x, tile.y);
        }
        assert.equal(state.phase, "won", `第 ${level} 关生成路径应可解`);
        assert.equal(state.beamComplete, true);
        assert.ok(state.stars >= 1 && state.stars <= 3);
        assert.ok(progress[String(level)] >= 1);
        vm.nextLevel();
    }
    assert.equal(state.level, 13);
    const stored = new Map();
    global.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
    const repository = new ProgressRepository();
    repository.save({ "1": 3 });
    assert.equal(repository.read()["1"], 3);
    delete global.localStorage;
    const wxMemory = new Map();
    global.wx = { getStorageSync: key => wxMemory.get(key), setStorageSync: (key, value) => wxMemory.set(key, value) };
    repository.save({ "2": 2 });
    assert.equal(repository.read()["2"], 2);
    delete global.wx;
    process.stdout.write("规则检查通过：12 关可解、暂停、提示、重置、星级与 Web/微信本地进度。\n");
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
