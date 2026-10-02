@echo off
rem ============================================================
rem AI 督学馆 任务计划程序注册(需管理员权限)
rem   start-all : 登录时启动三进程
rem   backup    : 每日 04:00 备份(保留 7 份)
rem 用法: 右键以管理员身份运行本脚本
rem ============================================================
setlocal

set "SCRIPTS=%~dp0"
set "START_BAT=%SCRIPTS%start-all.bat"
set "BACKUP_BAT=%SCRIPTS%backup.bat"

echo 正在注册任务计划(需要管理员权限)...

schtasks /create /tn "aidushu-start" /tr "\"%START_BAT%\"" /sc onlogon /rl limited /f >nul
if %errorlevel%==0 (echo [OK] aidushu-start: 登录时自动启动) else (echo [FAIL] aidushu-start)

schtasks /create /tn "aidushu-backup" /tr "\"%BACKUP_BAT%\"" /sc daily /st 04:00 /f >nul
if %errorlevel%==0 (echo [OK] aidushu-backup: 每日 04:00 备份) else (echo [FAIL] aidushu-backup)

echo.
echo 完成。可用 schtasks /query /tn aidushu-start 查看。
endlocal
