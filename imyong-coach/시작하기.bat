@echo off
chcp 65001 >nul
rem ============================================================
rem  임용 2차 AI 코치 실행 도우미 (Windows)
rem  더블클릭하면 Node.js 확인, 처음이면 설치, API 키 파일 준비,
rem  프로그램 실행, 브라우저 열기까지 차례로 진행합니다.
rem  API 키는 이 컴퓨터의 %APPDATA%\imyong-coach 폴더에도 보관해 두어
rem  ZIP을 새로 받아도 키를 다시 넣지 않아도 됩니다.
rem  주의: 첫 두 줄(echo off, chcp)보다 앞에 한글을 두지 마세요.
rem ============================================================
setlocal
cd /d "%~dp0"
title 임용 2차 AI 코치

echo.
echo  ==========================================
echo    임용 2차 AI 코치를 준비합니다
echo  ==========================================
echo.

if not exist "package.json" goto :not_extracted

where node >nul 2>nul
if errorlevel 1 goto :no_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)"
if errorlevel 1 goto :old_node

if exist "node_modules\next\package.json" goto :env
echo  [1/3] 처음 실행이라 필요한 프로그램을 설치합니다. 1~3분쯤 걸려요...
echo.
call npm install
if errorlevel 1 goto :install_failed
echo.

:env
set "KEY_DIR=%APPDATA%\imyong-coach"
set "KEY_BACKUP=%APPDATA%\imyong-coach\env.local"
if exist ".env.local" goto :check_key
if not exist "%KEY_BACKUP%" goto :new_key
copy /y "%KEY_BACKUP%" ".env.local" >nul
echo  [2/3] 이 컴퓨터에 보관해 둔 API 키 설정을 불러왔어요.
goto :check_key

:new_key
copy /y ".env.example" ".env.local" >nul
echo  [2/3] API 키 파일을 만들었어요. 곧 메모장이 열리면
echo        GEMINI_API_KEY= 바로 뒤에 키를 붙여 넣고, 저장한 다음 메모장을 닫으세요.
notepad ".env.local"

:check_key
findstr /r /c:"^GEMINI_API_KEY=[A-Za-z0-9_-]" ".env.local" >nul
if errorlevel 1 goto :empty_key
if not exist "%KEY_DIR%" mkdir "%KEY_DIR%"
copy /y ".env.local" "%KEY_BACKUP%" >nul
goto :run

:empty_key
echo  [!] .env.local 파일에 API 키가 비어 있어요. 화면은 열리지만 AI 분석은 할 수 없어요.
echo      키를 넣으려면 이 창을 닫고 notepad .env.local 로 연 뒤 다시 실행하세요.
echo.

:run
echo  [3/3] 프로그램을 켭니다. 준비되면 브라우저가 자동으로 열려요.
echo        이 검은 창을 닫으면 프로그램이 꺼집니다. 다 쓴 뒤에 닫으세요.
echo        브라우저 주소는 항상 http://localhost:3000 으로 열어 주세요.
echo.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 120; $i++) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:3000/' | Out-Null; break } catch { Start-Sleep -Seconds 1 } }; Start-Process 'http://localhost:3000'"
call npm run dev
echo.
echo  프로그램이 꺼졌어요.
pause
exit /b 0

:not_extracted
echo  [!] 필요한 파일을 찾지 못했어요. ZIP 파일 안에서 바로 실행했다면,
echo      먼저 ZIP의 압축을 모두 푼 뒤 imyong-coach 폴더 안의 이 파일을 실행하세요.
pause
exit /b 1

:no_node
echo  [!] Node.js가 설치되어 있지 않아요.
echo      열리는 nodejs.org 페이지에서 LTS 버전을 내려받아 설치한 뒤,
echo      컴퓨터를 다시 시작하지 않아도 되니 이 파일을 다시 실행하세요.
start "" "https://nodejs.org/ko/download"
pause
exit /b 1

:old_node
echo  [!] 설치된 Node.js 버전이 낮아요. nodejs.org에서 LTS 버전을 새로 설치한 뒤 다시 실행하세요.
start "" "https://nodejs.org/ko/download"
pause
exit /b 1

:install_failed
echo.
echo  [!] 설치에 실패했어요. 위에 나온 오류 메시지를 캡처해서 알려 주세요.
echo      학교 인터넷이 막혀 있을 수 있으니 다른 네트워크에서도 시도해 보세요.
pause
exit /b 1
