@echo off
REM Startet deinen Testserver lokal. Danach kommst du im Spiel ueber "localhost" rauf.
REM Benutzung (Windows): Doppelklick auf diese Datei.
cd /d "%~dp0"

echo [1/4] Plugin bauen...
call gradlew.bat build
if errorlevel 1 goto :ende

echo [2/4] Server-Ordner vorbereiten...
if not exist server\plugins mkdir server\plugins
copy /Y build\libs\MeinServer-*.jar server\plugins\ >nul

echo [3/4] Server-Datei suchen...
set "SERVERJAR="
for %%f in (server\spigot*.jar server\paper*.jar server\craftbukkit*.jar) do set "SERVERJAR=%%~nxf"
if "%SERVERJAR%"=="" (
  echo.
  echo !! Es liegt noch keine Server-Datei im Ordner "server\".
  echo    1^) Lade Spigot 1.8.8 herunter:  https://getbukkit.org/download/spigot
  echo    2^) Lege die Datei z.B. spigot-1.8.8.jar in den Ordner "server\".
  echo    3^) Starte diese Datei erneut.
  goto :ende
)

echo eula=true> server\eula.txt

echo [4/4] Server starten (%SERVERJAR%) ...
echo     -^> Im Spiel verbinden mit:  localhost
echo     -^> Zum Stoppen in dieser Konsole 'stop' eingeben.
cd server
java -Xmx2G -jar "%SERVERJAR%" nogui

:ende
echo.
pause
