package de.meinserver;

import org.bukkit.Location;
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

        // Legt die config.yml an, falls sie noch nicht existiert (für die Orte).
        saveDefaultConfig();

        // --- Befehle anmelden ---
        getCommand("hallo").setExecutor(new HalloCommand());
        getCommand("heile").setExecutor(new HeileCommand());
        getCommand("kompass").setExecutor(new KompassCommand());

        // /setspawn und /setcores werden von derselben Klasse behandelt.
        OrtCommand ortCommand = new OrtCommand(this);
        getCommand("setspawn").setExecutor(ortCommand);
        getCommand("setcores").setExecutor(ortCommand);

        // --- Events anmelden ---
        getServer().getPluginManager().registerEvents(new SpielerListener(), this);
        getServer().getPluginManager().registerEvents(new KompassListener(this), this);
    }

    @Override
    public void onDisable() {
        getLogger().info("MeinServer wurde gestoppt. Bis bald!");
    }

    // ---------------------------------------------------------------
    //  Gespeicherte Teleport-Orte (liegen in der config.yml)
    // ---------------------------------------------------------------

    /** Gibt den gespeicherten Spawn-Ort zurück (oder null, wenn nicht gesetzt). */
    public Location getSpawn() {
        return getConfig().getLocation("orte.spawn");
    }

    /** Gibt den gespeicherten Cores-Ort zurück (oder null, wenn nicht gesetzt). */
    public Location getCores() {
        return getConfig().getLocation("orte.cores");
    }

    /** Speichert einen neuen Spawn-Ort und schreibt ihn in die config.yml. */
    public void setSpawn(Location ort) {
        getConfig().set("orte.spawn", ort);
        saveConfig();
    }

    /** Speichert einen neuen Cores-Ort und schreibt ihn in die config.yml. */
    public void setCores(Location ort) {
        getConfig().set("orte.cores", ort);
        saveConfig();
    }
}
