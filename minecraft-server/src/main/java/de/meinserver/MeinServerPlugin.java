package de.meinserver;

import org.bukkit.plugin.java.JavaPlugin;

/**
 * Das ist die Haupt-Klasse deines Plugins.
 * Der Server ruft hier automatisch onEnable() beim Start
 * und onDisable() beim Stoppen auf.
 */
public final class MeinServerPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        // Diese Nachricht erscheint in der Server-Konsole, wenn das Plugin startet.
        getLogger().info("MeinServer wurde gestartet!");

        // --- Befehle anmelden ---
        // Wir verbinden den Befehlsnamen (aus plugin.yml) mit der Klasse,
        // die ausgeführt werden soll.
        getCommand("hallo").setExecutor(new HalloCommand());
        getCommand("heile").setExecutor(new HeileCommand());

        // --- Events anmelden ---
        // Damit unser Listener bei Ereignissen (z.B. Spieler joint) reagiert.
        getServer().getPluginManager().registerEvents(new SpielerListener(), this);
    }

    @Override
    public void onDisable() {
        getLogger().info("MeinServer wurde gestoppt. Bis bald!");
    }
}
