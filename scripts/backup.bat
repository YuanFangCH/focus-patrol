@echo off
rem ============================================================
rem AI 督学馆 每日备份: SQLite 数据库 + 违纪快照 uploads/
rem 保留最近 7 份,更早自动清理
rem 用法: 手动双击 / 任务计划程序每日定时(如 04:00)
rem ============================================================
setlocal

set "ROOT=%~dp0.."
set "SRC_DB=%ROOT%\backend\data\aidushu.sqlite"
set "SRC_UPLOAD=%ROOT%\backend\uploads"
set "BACKUP_ROOT=%ROOT%\backups"

rem 备份目录名: 20260807-0400
for /f "tokens=1-2 delims=." %%a in ("%date%") do set D=%%a
for /f %%t in ("%time: =0%") do set T=%%t
set STAMP=%D%-%T:~0,2%%T:~3,2%
set "DEST=%BACKUP_ROOT%\%STAMP%"

mkdir "%DEST%" 2>nul

rem ---- 1. 数据库 ----
copy /y "%SRC_DB%" "%DEST%\aidushu.sqlite" >nul
if exist "%SRC_DB%-wal" copy /y "%SRC_DB%-wal" "%DEST%\" >nul 2>nul
if exist "%SRC_DB%-shm" copy /y "%SRC_DB%-shm" "%DEST%\" >nul 2>nul

rem ---- 2. uploads ----
if exist "%SRC_UPLOAD%" (
  robocopy "%SRC_UPLOAD%" "%DEST%\uploads" /E /NFL /NDL /NJH /NJS /NP >nul
)

rem ---- 3. 清理: 保留最近 7 份 ----
set /a KEEP=0
for /f "delims=" %%d in ('dir /b /ad /o-n "%BACKUP_ROOT%"') do (
  set /a KEEP+=1
  setlocal enabledelayedexpansion
  if !KEEP! gtr 7 rd /s /q "%BACKUP_ROOT%\%%d"
  endlocal
)

echo [%date% %time%] 备份完成: %DEST%
endlocal
