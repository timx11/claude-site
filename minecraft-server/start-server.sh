#!/usr/bin/env bash
# Startet deinen Testserver lokal. Danach kommst du im Spiel über "localhost" rauf.
# Benutzung (Mac/Linux): im Terminal  ./start-server.sh
set -e
cd "$(dirname "$0")"

echo "[1/4] Plugin bauen..."
./gradlew build

echo "[2/4] Server-Ordner vorbereiten..."
mkdir -p server/plugins
cp build/libs/MeinServer-*.jar server/plugins/

# Nach einer Server-Datei suchen (Spigot/Paper/CraftBukkit).
SERVERJAR=$(ls server/spigot*.jar server/paper*.jar server/craftbukkit*.jar 2>/dev/null | head -n1 || true)
if [ -z "$SERVERJAR" ]; then
  echo
  echo "!! Es liegt noch keine Server-Datei im Ordner 'server/'."
  echo "   1) Lade Spigot 1.8.8 herunter:  https://getbukkit.org/download/spigot"
  echo "   2) Lege die Datei (z.B. spigot-1.8.8.jar) in den Ordner 'server/'."
  echo "   3) Starte dieses Skript erneut."
  exit 1
fi

echo "[3/4] EULA akzeptieren..."
echo "eula=true" > server/eula.txt

echo "[4/4] Server starten ($SERVERJAR)..."
echo "    -> Im Spiel verbinden mit:  localhost"
echo "    -> Zum Stoppen in dieser Konsole 'stop' eingeben."
cd server
java -Xmx2G -jar "$(basename "$SERVERJAR")" nogui
