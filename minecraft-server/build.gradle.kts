plugins {
    // Java-Unterstützung
    java
}

// Gruppen-/Versionsangaben für dein Projekt
group = "de.meinserver"
version = "1.0.0"

repositories {
    // Hier sucht Gradle nach Bibliotheken
    mavenCentral()
    // Das Spigot-Repository (enthält die Spigot-API für Minecraft 1.8.8)
    maven("https://hub.spigotmc.org/nexus/content/repositories/snapshots/")
    // Wird von der Spigot-API teilweise mitbenötigt
    maven("https://oss.sonatype.org/content/repositories/snapshots/")
}

dependencies {
    // Die Spigot-API für Minecraft 1.8.8: damit kannst du Spieler, Blöcke,
    // Events usw. ansprechen.
    // "compileOnly" = nur zum Programmieren nötig, der Server bringt sie selbst mit.
    compileOnly("org.spigotmc:spigot-api:1.8.8-R0.1-SNAPSHOT")
}

tasks {
    withType<JavaCompile> {
        // Minecraft 1.8.8 läuft auf Java 8 -> wir erzeugen Java-8-Bytecode.
        options.release.set(8)
        // Umlaute/Sonderzeichen korrekt einlesen
        options.encoding = "UTF-8"
    }

    // Dateien wie plugin.yml mit UTF-8 verarbeiten
    processResources {
        filteringCharset = "UTF-8"
        // Ersetzt ${version} in der plugin.yml durch die Version oben
        val props = mapOf("version" to version)
        inputs.properties(props)
        filesMatching("plugin.yml") {
            expand(props)
        }
    }
}
