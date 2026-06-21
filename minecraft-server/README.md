# MeinServer 🟩 — dein erster Minecraft-Server (Java Edition 1.8.8)

Das hier ist ein **Spigot-Plugin** für **Minecraft 1.8.8** — die Version, die
für PvP-Server sehr beliebt ist. Statt einen ganzen Server von Null zu
programmieren, bauen wir auf Spigot auf und schreiben die **Spiellogik selbst**
in Java — genau so machen es echte Server.

Dieses Grundgerüst bringt schon mit:

- **Menü-Kompass** — jeder Spieler bekommt beim Beitreten einen Kompass.
  Rechtsklick öffnet ein Menü mit den Feldern **Spawn** und **Cores**; ein Klick
  teleportiert dorthin.
- `/setspawn` / `/setcores` — Admin setzt die beiden Teleport-Orte (gespeichert
  in `config.yml`)
- `/kompass` — gibt dir den Kompass erneut
- `/hallo` — begrüßt den Spieler
- `/heile` — füllt Leben und Hunger wieder auf
- Eine Willkommensnachricht, wenn ein Spieler den Server betritt

> **Wichtig:** Minecraft 1.8.8 ist alt und braucht **Java 8** zum Laufen.
> Mit neuem Java (17/21) stürzt ein 1.8.8-Server ab.

---

## ⚡ Schnellstart (Testserver über localhost)

Der Testserver läuft auf **deinem eigenen PC**. „localhost" bedeutet genau
diesen Rechner — du verbindest dich also mit dem Server, der bei dir läuft.

Einmalig vorbereiten:

1. **Java 8** installieren (siehe Punkt 0 unten).
2. **Spigot 1.8.8** herunterladen: <https://getbukkit.org/download/spigot>
   und die Datei (z. B. `spigot-1.8.8.jar`) in den Unterordner **`server/`**
   legen. Den Ordner `server/` legt das Start-Skript beim ersten Lauf an —
   du kannst ihn aber auch jetzt schon selbst erstellen.

Starten:

- **Windows:** Doppelklick auf **`start-server.bat`**
- **Mac/Linux:** im Terminal `./start-server.sh`

Das Skript baut das Plugin, richtet den Server ein, akzeptiert die EULA und
startet ihn. Dann im **Minecraft-Client 1.8.8**:
*Mehrspieler → Direkt verbinden → `localhost` → Beitreten*.

> Server stoppen: in der schwarzen Konsole `stop` eintippen (Enter).

Die ausführliche Erklärung jedes Schritts steht weiter unten.

---

## 0. Was du einmalig installieren musst

1. **Java 8 (JDK)** — z. B. von [Adoptium / Temurin 8](https://adoptium.net/temurin/releases/?version=8).
   Wir nutzen Java 8 zum **Bauen** und zum **Server starten**.
   Prüfen im Terminal:
   ```
   java -version
   ```
   Es sollte `1.8` erscheinen.
2. **Einen Editor** — empfohlen: [IntelliJ IDEA Community](https://www.jetbrains.com/idea/download/)
   (kostenlos, ideal für Java) oder [VS Code](https://code.visualstudio.com/).

> Gradle musst du **nicht** installieren — das Projekt bringt es über den
> "Gradle Wrapper" (`gradlew`) selbst mit.

---

## 1. Plugin bauen

Im Ordner `minecraft-server/` im Terminal:

- **Windows:**
  ```
  gradlew.bat build
  ```
- **Mac/Linux:**
  ```
  ./gradlew build
  ```

Beim ersten Mal lädt Gradle die Spigot-API herunter (kurz Geduld). Wenn alles
klappt, steht am Ende `BUILD SUCCESSFUL`. Deine fertige Plugin-Datei liegt dann
hier:

```
build/libs/MeinServer-1.0.0.jar
```

---

## 2. Einen 1.8.8-Server einrichten

Anders als bei neueren Versionen gibt es für 1.8.8 keinen
`./gradlew runServer`-Knopf. Du richtest den Server einmal manuell ein:

1. Besorge dir eine **Spigot- oder Paper-Server-Datei für 1.8.8**:
   - Bequem als fertige Datei z. B. über <https://getbukkit.org/download/spigot>
     (`spigot-1.8.8.jar`), **oder**
   - selbst bauen mit dem offiziellen [BuildTools](https://www.spigotmc.org/wiki/buildtools/):
     ```
     java -jar BuildTools.jar --rev 1.8.8
     ```
2. Lege die Server-Datei in einen leeren Ordner (z. B. `server/`) und starte sie
   **mit Java 8**:
   ```
   java -Xmx2G -jar spigot-1.8.8.jar nogui
   ```
3. Der Start bricht beim ersten Mal ab und erzeugt eine Datei `eula.txt`.
   Öffne sie, ändere `eula=false` zu `eula=true`, speichern.
4. Starte den Server erneut (gleicher Befehl wie oben). Jetzt läuft er.

---

## 3. Dein Plugin einbauen und testen

1. Kopiere deine `build/libs/MeinServer-1.0.0.jar` in den Unterordner
   `plugins/` deines Servers.
2. Server neu starten (oder im laufenden Server `reload` eingeben).
3. Starte den **Minecraft-Client in Version 1.8.8** (im Launcher als Profil
   anlegen) und verbinde dich:
   `Mehrspieler → Direkt verbinden → Adresse: localhost → Beitreten`.
4. Probiere im Spiel `/hallo` und `/heile` aus.

> Server in der Konsole sauber stoppen: `stop` eingeben (nicht das Fenster
> einfach schließen).

---

## 3b. Den Kompass benutzen (Spawn & Cores)

1. Geh als **Operator** (Admin) im Spiel an die Stelle, die der Spawn sein soll,
   und tippe `/setspawn`. Dann an die Cores-Stelle und `/setcores`.
   (Op wirst du in der Server-Konsole mit `op DEINNAME`.)
2. Jetzt hat jeder beim Beitreten einen **Kompass** im ersten Slot.
   **Rechtsklick** öffnet das Menü.
3. Im Menü auf **Spawn** (Smaragd) oder **Cores** (Leuchtfeuer) klicken →
   du wirst sofort teleportiert.

> Verloren? Mit `/kompass` bekommst du einen neuen.

---

## 4. Projektstruktur (was liegt wo?)

```
minecraft-server/
├─ build.gradle.kts        ← Bau-Konfiguration (Abhängigkeiten, Java-Version)
├─ settings.gradle.kts     ← Projektname
├─ gradlew / gradlew.bat   ← Startet Gradle (kein Extra-Install nötig)
└─ src/main/
   ├─ java/de/meinserver/
   │  ├─ MeinServerPlugin.java  ← Start/Stop, meldet Befehle & Events an, speichert Orte
   │  ├─ HalloCommand.java      ← Befehl /hallo
   │  ├─ HeileCommand.java      ← Befehl /heile
   │  ├─ KompassCommand.java    ← Befehl /kompass (gibt den Kompass)
   │  ├─ OrtCommand.java        ← Befehle /setspawn und /setcores
   │  ├─ KompassMenue.java      ← baut den Kompass und das Auswahl-Menü
   │  ├─ KompassListener.java   ← öffnet das Menü & teleportiert beim Klick
   │  └─ SpielerListener.java   ← reagiert auf "Spieler betritt Server"
   └─ resources/
      ├─ plugin.yml             ← Name des Plugins + Liste der Befehle
      └─ config.yml             ← Speicher für Spawn-/Cores-Orte
```

**Faustregel zum Erweitern:**
- Neuer Befehl → neue `XyzCommand.java` schreiben, in `plugin.yml` eintragen,
  in `MeinServerPlugin.onEnable()` mit `getCommand(...).setExecutor(...)` anmelden.
- Auf ein neues Ereignis reagieren (Block abbauen, Mob stirbt …) →
  eine `@EventHandler`-Methode im Listener ergänzen.

---

## 5. Ideen für die nächsten Schritte (typisch für 1.8-PvP-Server)

- `/spawn` — teleportiert zum Welt-Spawn
- `/kit` — gibt ein PvP-Set (Rüstung, Schwert, Goldäpfel)
- Kein Hunger-/kein Schaden-Schutz in der Spawn-Zone
- Ein einfaches Kill-/Punkte-System
- Soup-PvP oder ein kleines Arena-Minispiel

Sag einfach, was als Nächstes kommen soll — wir bauen es Schritt für Schritt. 🚀
