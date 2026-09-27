import { GameViewModel } from "./viewmodel/GameViewModel";
import { ProgressRepository } from "./repository/ProgressRepository";
import { GamePage } from "./page/GamePage";

const { regClass } = Laya;

interface WechatLifecycle {
    onHide(callback: () => void): void;
    offHide?(callback: () => void): void;
}

@regClass()
export class Main extends Laya.Script {
    private viewModel: GameViewModel;
    private page: GamePage;

    onStart(): void {
        Laya.stage.designWidth = 720;
        Laya.stage.designHeight = 1280;
        Laya.stage.scaleMode = Laya.Stage.SCALE_SHOWALL;
        Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
        Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
        Laya.stage.bgColor = "#080e2a";
        Laya.stage.updateCanvasSize();
        this.viewModel = new GameViewModel(new ProgressRepository());
        this.page = new GamePage(this.owner as Laya.Scene, {
            start: () => this.viewModel.start(), pause: () => this.viewModel.togglePause(),
            rotate: (x, y) => this.viewModel.rotate(x, y), hint: () => this.viewModel.hint(),
            restart: () => this.viewModel.restart(), next: () => this.viewModel.nextLevel()
        });
        this.viewModel.subscribe(state => this.page.render(state));
        Laya.stage.on(Laya.Event.KEY_DOWN, this, this.handleKeyDown);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisibility);
        this.wechat()?.onHide(this.onWechatHide);
        Laya.timer.frameLoop(1, this, this.tick);
    }

    private tick(): void { this.viewModel.update(Math.min(Laya.timer.delta / 1000, 0.05)); }
    private handleKeyDown(event: Laya.Event): void {
        const key = String((event as any).key || "").toLowerCase();
        if (key === " " || key === "escape" || key === "p") this.viewModel.togglePause();
        else if (key === "enter") this.viewModel.start();
    }
    private onVisibility = (): void => { if (document.hidden) this.viewModel.pause(); };
    private onWechatHide = (): void => this.viewModel.pause();
    private wechat(): WechatLifecycle | undefined {
        return (globalThis as typeof globalThis & { wx?: WechatLifecycle }).wx;
    }

    onDestroy(): void {
        Laya.timer.clear(this, this.tick);
        Laya.stage.off(Laya.Event.KEY_DOWN, this, this.handleKeyDown);
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisibility);
        this.wechat()?.offHide?.(this.onWechatHide);
        this.page?.dispose();
    }
}
