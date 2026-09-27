# 棱镜回路

Prism-circuit

基于 LayaAir 3.4 的竖屏光路解谜小游戏。旋转直线和转角模块，将左侧光源接到右侧星核。原工程《月夜拾光》保持独立；本作没有收集、躲避或生存计时玩法。

## 玩法与引擎表现

- 轻点模块顺时针旋转；光束按当前连接实时追踪，断路、偏转、闭环都有即时反馈。
- 第 1 关是 3×3 入门关，只需跟随发光边框点击五块模块，每块旋转一次；第 2 关为 4×4，第 3–7 关 5×5，第 8 关起 6×6。后续关卡按编号固定生成，可重复挑战。
- 按步数获得 1–3 星，本机记录每关最佳星级。可重置关卡或使用一次提示，提示会校准当前路径上首块未对齐模块，并将本关最高评级限制为 2 星。
- 使用 LayaAir 2D Sprite、Graphics、逐帧光束动画与触控事件实现；画面由引擎实时绘制，不依赖远程图片或服务。手机触控与电脑鼠标均可操作。

## 运行和查看效果

工程入口：[棱镜回路.laya](棱镜回路.laya)。在 LayaAir IDE 3.4 打开即可运行。Web 预览：

```bash
./scripts/build.sh
./scripts/preview.sh
```

浏览器打开 `http://127.0.0.1:8799/`。如端口占用，可执行 `PORT=8800 ./scripts/preview.sh`。已构建的 Web 文件在 `release/web/`；同目录还提供可直接解压预览的 `棱镜回路-Web.zip`。

## Cloudflare Pages 部署

公开游戏：[prism-circuit-xieyuhai.pages.dev](https://prism-circuit-xieyuhai.pages.dev/)。Cloudflare 项目为 `prism-circuit-xieyuhai`，当前使用 Pages Direct Upload，GitHub 仓库保存源码和 `release/web/` 构建产物。推送 GitHub 不会自动更新 Pages；每次修改源码后运行：

```bash
./scripts/build.sh
node scripts/check-rules.cjs
npx wrangler pages deploy release/web --project-name prism-circuit-xieyuhai --branch main
```

上传后再提交源码和新的 `release/web/` 文件到 [GitHub 仓库](https://github.com/xieyuhai/Prism-circuit)。

`build.sh` 优先调用 `~/.layaair/layaair`，可用 `LAYAAIR_CLI` 指定官方 CLI。未安装 CLI 时，使用已包含的 LayaAir 3.4 Web 运行库与 TypeScript 编译器生成预览包；可用 `TSC_BIN` 指定 `tsc`。环境要求 Node.js、Python 3、TypeScript 或 LayaAir IDE/CLI 3.4。规则检查：`node scripts/check-rules.cjs`。

微信小游戏请在 LayaAir IDE 选择“微信小游戏”构建，再将 `release/wxgame` 导入微信开发者工具并进行真机预览。Web 包不能直接上传为微信小游戏。本工程已处理 `wx.onHide` 暂停和 `wx.getStorageSync` / `wx.setStorageSync` 本地进度；微信构建和真机效果需在平台工具内验证。

## 架构与 API

| 模块 | 职责 |
| --- | --- |
| `src/Main.ts` | LayaAir 生命周期、后台暂停、键盘入口和帧驱动 |
| `src/page/GamePage.ts` | 绘制与输入事件转发，不计算路径和得分 |
| `src/viewmodel/GameViewModel.ts` | 唯一游戏状态源，关卡生成、光束追踪、步数、提示和结算 |
| `src/model/GameModels.ts` | Entity 与 UIModel 类型 |
| `src/repository/ProgressRepository.ts` | Web / 微信本地最佳星级读写网关 |
| `src/config/zh_CN.ts` | 全部中文可见文案 |

页面事件 API：`start()`、`pause()`、`togglePause()`、`rotate(x,y)`、`hint()`、`restart()`、`nextLevel()`。状态通过 `subscribe(GameUIModel)` 单向推送到页面；无远程 REST API、DTO 或敏感数据。

## 数据字典

| 字段 | 含义 |
| --- | --- |
| `phase` | `ready`、`playing`、`paused`、`won` |
| `level` / `size` | 关卡编号 / 方形棋盘边长 |
| `entryRow` / `exitRow` | 左侧光源与右侧星核行号 |
| `tiles.kind` | `straight` 直线，`elbow` 转角 |
| `tiles.rotation` | 当前方向；直线 0–1，转角 0–3 |
| `tiles.target` / `tiles.path` | 生成器的解法方向 / 是否属于生成路径；仅供逻辑和提示使用 |
| `beam` / `beamComplete` | 光束经过的格点 / 是否抵达星核 |
| `guide` | 第 1 关下一块建议点击的模块坐标 |
| `moves` / `par` / `stars` | 玩家步数 / 参考步数 / 本关星级 |
| `bestStars` / `hintUsed` | 本关历史最佳 / 是否用过提示 |

仅保存 `prism-circuit.progress.v2`：关卡编号到 1–3 星的映射，不存身份、权限或设备信息。入门关版本使用独立存档键，避免旧关卡进度跳过教学。

## 商业化与发布

关卡结算和一次性提示为后续激励视频提供自然入口；星核皮肤、光束色彩、去广告可作为付费外观或功能。当前版本**没有接入广告、支付、账号或分析 SDK**，也不展示虚假的广告按钮。接入前需完成平台 SDK 技术评审、权限与隐私说明，并在微信真机验证。

- 配置：`settings/PlayerSettings.json` 为 720×1280 竖屏设计分辨率，`settings/BuildSettings.json` 定义名称与启动场景。
- 打包：`scripts/build.sh` 生成 Web 包；平台包使用 LayaAir IDE/CLI 的目标平台发布。Web 无签名要求；微信小游戏使用平台 AppID、开发者主体和发布审核，签名按目标平台配置。
- SDK 与 License：仅使用 LayaAir 3.4 引擎运行库；其 [MIT License](https://github.com/layabox/LayaAir/blob/LayaAir_3.4/LICENSE) 及源码/美术授权说明见 [LICENSE.md](LICENSE.md)。TypeScript 为构建工具。
- 版本记录：v1.0.1，2026-09-27。增加 3×3 五步入门关与逐格引导；v1.0.0 首次交付光路生成、实时光束、星级、提示、暂停及本地进度。
- 验证范围：TypeScript 构建、12 关生成路径可解、Web 浏览器的开始/旋转/提示与画面预览。微信真机、性能、横竖屏、深色模式和支付广告均未完成平台验证。
