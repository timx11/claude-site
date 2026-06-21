package de.meinserver;

import org.bukkit.ChatColor;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.ItemStack;

/**
 * Steuert den Kompass: Rechtsklick öffnet das Menü,
 * ein Klick im Menü teleportiert den Spieler.
 */
public class KompassListener implements Listener {

    // Wir brauchen das Plugin, um an die gespeicherten Orte zu kommen.
    private final MeinServerPlugin plugin;

    public KompassListener(MeinServerPlugin plugin) {
        this.plugin = plugin;
    }

    /** Rechtsklick mit dem Kompass -> Menü öffnen. */
    @EventHandler
    public void beimKlicken(PlayerInteractEvent event) {
        Action aktion = event.getAction();
        // Nur auf Rechtsklick reagieren (in die Luft oder auf einen Block).
        if (aktion != Action.RIGHT_CLICK_AIR && aktion != Action.RIGHT_CLICK_BLOCK) {
            return;
        }
        // Hält der Spieler unseren Menü-Kompass?
        if (!KompassMenue.istKompass(event.getItem())) {
            return;
        }
        // Verhindert, dass dabei z.B. ein Block platziert wird.
        event.setCancelled(true);
        event.getPlayer().openInventory(KompassMenue.erstelleMenue());
    }

    /** Klick im Menü -> teleportieren. */
    @EventHandler
    public void beimMenueKlick(InventoryClickEvent event) {
        // Nur unser eigenes Menü behandeln (am Titel erkennbar).
        if (!event.getView().getTitle().equals(KompassMenue.TITEL)) {
            return;
        }
        // Solange das Menü offen ist, darf nichts herausgenommen werden.
        event.setCancelled(true);

        ItemStack geklickt = event.getCurrentItem();
        if (geklickt == null || !geklickt.hasItemMeta() || !geklickt.getItemMeta().hasDisplayName()) {
            return;
        }
        if (!(event.getWhoClicked() instanceof Player)) {
            return;
        }
        Player spieler = (Player) event.getWhoClicked();
        String name = geklickt.getItemMeta().getDisplayName();

        if (name.equals(KompassMenue.SPAWN_NAME)) {
            teleportiere(spieler, plugin.getSpawn(), "Spawn", "/setspawn");
        } else if (name.equals(KompassMenue.CORES_NAME)) {
            teleportiere(spieler, plugin.getCores(), "Cores", "/setcores");
        }
    }

    /** Teleportiert den Spieler oder meldet, dass der Ort noch nicht gesetzt ist. */
    private void teleportiere(Player spieler, Location ziel, String anzeigeName, String setzBefehl) {
        spieler.closeInventory();
        if (ziel == null) {
            spieler.sendMessage(ChatColor.RED + "Der Ort \"" + anzeigeName
                    + "\" wurde noch nicht gesetzt. (Admin: " + setzBefehl + ")");
            return;
        }
        spieler.teleport(ziel);
        spieler.sendMessage(ChatColor.GREEN + "Teleportiert zu " + anzeigeName + "!");
    }
}
