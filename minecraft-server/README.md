# MeinServer 🟩 — dein erster Minecraft-Server (Java Edition)

Das hier ist ein **Paper-Plugin**. Paper ist eine schnelle, erweiterbare
Server-Software für Minecraft Java Edition. Statt einen ganzen Server von Null
zu programmieren, bauen wir auf Paper auf und schreiben die **Spiellogik selbst**
in Java — genau so machen es echte Server.

Dieses Grundgerüst bringt schon mit:

- `/hallo` — begrüßt den Spieler
- `/heile` — füllt Leben und Hunger wieder auf
- Eine Willkommensnachricht, wenn ein Spieler den Server betritt

---

## 0. Was du einmalig installieren musst

1. **Java 21 (JDK)** — z. B. von [Adoptium / Temurin](https://adoptium.net/).
   Prüfen im Terminal:
   ```
   java -version
   ```
   Es sollte `21` erscheinen.
2. **Einen Editor** — empfohlen: [IntelliJ IDEA Community](https://www.jetbrains.com/idea/download/)
   (kostenlos, ideal für Java) oder [VS Code](https://code.visualstudio.com/).

> Gradle musst du **nicht** installieren — das Projekt bringt es über den
> "Gradle Wrapper" (`gradlew`) selbst mit.

---

## 1. Projekt bauen

Im Ordner `minecraft-server/` im Terminal:

- **Windows:**
  ```
  gradlew.bat build
  ```
- **Mac/Linux:**
  ```
  ./gradlew build
  ```

Beim ersten Mal lädt Gradle die Paper-API herunter (kurz Geduld). Wenn alles
klappt, steht am Ende `BUILD SUCCESSFUL`. Deine fertige Plugin-Datei liegt dann
hier:

```
build/libs/MeinServer-1.0.0.jar
```

---

## 2. Sofort testen (einfachster Weg) ✅

Du brauchst **keinen** Server herunterzuladen. Dieser Befehl startet automatisch
einen Test-Server mit deinem Plugin:

- **Windows:** `gradlew.bat runServer`
- **Mac/Linux:** `./gradlew runServer`

Beim ersten Start musst du im selben Terminal die Minecraft-EULA akzeptieren:
Tippe `stop` (Enter), öffne die neu erzeugte Datei `run/eula.txt`, ändere
`eula=false` zu `eula=true`, speichern, und starte `runServer` erneut.

Dann im **Minecraft-Client (Java Edition, Version 1.21.4)**:
`Mehrspieler → Direkt verbinden → Adresse: localhost → Beitreten`.

Probiere im Spiel `/hallo` und `/heile` aus.

> Server in der Konsole sauber stoppen: `stop` eingeben (nicht das Fenster
> einfach schließen).

---

## 3. Auf einem "echten" Server benutzen

1. Lade Paper für 1.21.4 von <https://papermc.io/downloads> herunter
   (`paper-1.21.4-XXX.jar`).
2. Lege es in einen leeren Ordner und starte es einmal, z. B.:
   ```
   java -Xmx2G -jar paper-1.21.4-XXX.jar nogui
   ```
3. EULA akzeptieren (siehe oben, `eula.txt`).
4. Kopiere deine `build/libs/MeinServer-1.0.0.jar` in den Unterordner `plugins/`.
5. Server neu starten — dein Plugin lädt automatisch.

---

## 4. Projektstruktur (was liegt wo?)

```
minecraft-server/
├─ build.gradle.kts        ← Bau-Konfiguration (Abhängigkeiten, Java-Version)
├─ settings.gradle.kts     ← Projektname
├─ gradlew / gradlew.bat   ← Startet Gradle (kein Extra-Install nötig)
└─ src/main/
   ├─ java/de/meinserver/
   │  ├─ MeinServerPlugin.java  ← Start/Stop, meldet Befehle & Events an
   │  ├─ HalloCommand.java      ← Befehl /hallo
   │  ├─ HeileCommand.java      ← Befehl /heile
   │  └─ SpielerListener.java   ← reagiert auf "Spieler betritt Server"
   └─ resources/
      └─ plugin.yml             ← Name des Plugins + Liste der Befehle
```

**Faustregel zum Erweitern:**
- Neuer Befehl → neue `XyzCommand.java` schreiben, in `plugin.yml` eintragen,
  in `MeinServerPlugin.onEnable()` mit `getCommand(...).setExecutor(...)` anmelden.
- Auf ein neues Ereignis reagieren (Block abbauen, Mob stirbt …) →
  eine `@EventHandler`-Methode im Listener ergänzen.

---

## 5. Ideen für die nächsten Schritte

- `/spawn` — teleportiert zum Welt-Spawn
- `/fly` — Flugmodus an/aus
- Ein Willkommens-Item beim ersten Beitreten geben
- Ein einfaches Punkte-/Economy-System
- Ein kleines Minispiel

Sag einfach, was als Nächstes kommen soll — wir bauen es Schritt für Schritt. 🚀
