# 安装包目录

本目录预留给 Windows 安装包、便携包和 SakuraFrp 启动器相关资源，当前没有已提交的构建产物。

## 现状

- 本机部署目前使用根目录 `scripts/start-all.bat`，不依赖安装包。
- 公网访问通过 SakuraFrp 的 TCP 隧道接入 `proxy.js`（默认 `127.0.0.1:8888`）。
- 构建产物、安装包和第三方安装程序不应提交到版本库；如需保留，在放入本目录后确认根 `.gitignore` 已覆盖对应扩展名。

## 后续放置约定

如果新增打包流程，建议按以下方式组织：

```
installers/
├─ aidushu-setup-<version>.exe     # 主程序安装包
├─ aidushu-portable-<version>.zip  # 便携版
└─ sakura/                          # SakuraFrp 启动器与配置模板
```

安装包应至少说明：目标 Windows 版本、Node.js 依赖是否需要预置、默认安装路径、服务端口、卸载方式，以及首次启动后如何进入管理面板建号。

