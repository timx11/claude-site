package de.meinserver;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

/**
 * Ein "Listener" hört auf Ereignisse (Events), die im Spiel passieren.
 * Hier reagieren wir darauf, wenn ein Spieler den Server betritt.
 */
public class SpielerListener implements Listener {

    // @EventHandler markiert die Methode, die beim Event aufgerufen wird.
    @EventHandler
    public void beimBeitreten(PlayerJoinEvent event) {
        Player spieler = event.getPlayer();

        // Persönliche Nachricht nur an den beitretenden Spieler.
        spieler.sendMessage(
                Component.text("Willkommen, " + spieler.getName() + "!", NamedTextColor.AQUA)
        );

        // Die Nachricht, die alle anderen Spieler im Chat sehen.
        event.joinMessage(
                Component.text(spieler.getName() + " ist dem Server beigetreten.", NamedTextColor.YELLOW)
        );
    }
}
