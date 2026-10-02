@echo off
rem ============================================================
rem AI 督学馆 一键启动(后端/前端/反代) + 崩溃自愈循环
rem 用于: 任务计划程序登录自启 / 启动文件夹 / 手动双击
rem 每个进程在独立最小化窗口运行,退出后 3 秒自动重启
rem ============================================================
setlocal

set "ROOT=%~dp0.."

rem ---- 后端 3001 ----
start "aidushu-api" /min cmd /c "cd /d %ROOT%\backend & :loop & node dist/main.js & ping -n 4 127.0.0.1 >nul & goto loop"

rem ---- 前端 3000 ----
start "aidushu-web" /min cmd /c "cd /d %ROOT%\frontend & :loop & node node_modules\next\dist\bin\next start -p 3000 & ping -n 4 127.0.0.1 >nul & goto loop"

rem ---- 反代 8888 ----
start "aidushu-proxy" /min cmd /c "cd /d %ROOT% & :loop & node proxy.js & ping -n 4 127.0.0.1 >nul & goto loop"

rem ---- 管理面板 3002(仅本机) ----
start "aidushu-admin" /min cmd /c "cd /d %ROOT%\frontend & :loop & node node_modules\next\dist\bin\next start -H 127.0.0.1 -p 3002 & ping -n 4 127.0.0.1 >nul & goto loop"

echo 已启动: aidushu-api(3001) / aidushu-web(3000) / aidushu-proxy(8888) / aidushu-admin(3002)
echo 提示: 最小化窗口为各进程日志;关闭窗口即停止该进程;进程崩溃 3 秒后自动重启。
endlocal
