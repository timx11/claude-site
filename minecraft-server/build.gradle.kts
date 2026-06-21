plugins {
    // Java-Unterstützung
    java
    // "run-paper" gibt uns den Befehl ./gradlew runServer, der automatisch
    // einen Paper-Server herunterlädt und dein Plugin darauf startet.
    id("xyz.jpenilla.run-paper") version "2.3.1"
}

// Gruppen-/Versionsangaben für dein Projekt
group = "de.meinserver"
version = "1.0.0"

repositories {
    // Hier sucht Gradle nach Bibliotheken
    mavenCentral()
    // Das offizielle Paper-Repository (enthält die Paper-API)
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    // Die Paper-API: damit kannst du Spieler, Blöcke, Events usw. ansprechen.
    // "compileOnly" = nur zum Programmieren nötig, der Server bringt sie selbst mit.
    compileOnly("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")
}

java {
    // Minecraft 1.21 braucht Java 21
    toolchain.languageVersion.set(JavaLanguageVersion.of(21))
}

tasks {
    // Dateien wie plugin.yml mit UTF-8 verarbeiten (für Umlaute/Emojis)
    processResources {
        filteringCharset = "UTF-8"
        // Ersetzt ${version} in der plugin.yml durch die Version oben
        val props = mapOf("version" to version)
        inputs.properties(props)
        filesMatching("plugin.yml") {
            expand(props)
        }
    }

    // Konfiguration für ./gradlew runServer (Test-Server)
    runServer {
        minecraftVersion("1.21.4")
    }
}
