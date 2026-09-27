interface WechatStorage {
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
}

export class ProgressRepository {
    private readonly key = "prism-circuit.progress.v2";

    read(): Record<string, number> {
        try {
            const raw = this.wechat()?.getStorageSync(this.key) ?? localStorage.getItem(this.key);
            const value = JSON.parse(String(raw || "{}"));
            if (!value || typeof value !== "object" || Array.isArray(value)) return {};
            const result: Record<string, number> = {};
            for (const [key, stars] of Object.entries(value)) {
                if (/^[1-9]\d{0,3}$/.test(key) && Number.isInteger(stars) && (stars as number) >= 1 && (stars as number) <= 3)
                    result[key] = stars as number;
            }
            return result;
        } catch { return {}; }
    }

    save(progress: Record<string, number>): void {
        try {
            const value = JSON.stringify(progress);
            const wx = this.wechat();
            if (wx) wx.setStorageSync(this.key, value);
            else localStorage.setItem(this.key, value);
        } catch { /* Local progress is optional. */ }
    }

    private wechat(): WechatStorage | undefined {
        return (globalThis as typeof globalThis & { wx?: WechatStorage }).wx;
    }
}
