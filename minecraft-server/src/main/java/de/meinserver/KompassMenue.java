package de.meinserver;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

/**
 * Baut den Menü-Kompass und das dazugehörige Auswahl-Menü.
 * Hier liegen alle "Bausteine" an einer Stelle, damit der Code übersichtlich bleibt.
 */
public class KompassMenue {

    // Titel des Menü-Fensters. Daran erkennen wir später auch die Klicks wieder.
    public static final String TITEL = ChatColor.DARK_AQUA + "Teleporter";

    // Der Anzeigename des Kompasses in der Hand.
    public static final String KOMPASS_NAME = ChatColor.AQUA + "Menü " + ChatColor.GRAY + "(Rechtsklick)";

    // Die Namen der beiden Auswahl-Felder.
    public static final String SPAWN_NAME = ChatColor.GREEN + "Spawn";
    public static final String CORES_NAME = ChatColor.GOLD + "Cores";

    /** Erstellt den Kompass, den der Spieler in die Hand bekommt. */
    public static ItemStack erstelleKompass() {
        ItemStack kompass = new ItemStack(Material.COMPASS);
        ItemMeta meta = kompass.getItemMeta();
        meta.setDisplayName(KOMPASS_NAME);
        kompass.setItemMeta(meta);
        return kompass;
    }

    /** Prüft, ob ein Item unser Menü-Kompass ist. */
    public static boolean istKompass(ItemStack item) {
        if (item == null || item.getType() != Material.COMPASS) {
            return false;
        }
        ItemMeta meta = item.getItemMeta();
        return meta != null && meta.hasDisplayName() && meta.getDisplayName().equals(KOMPASS_NAME);
    }

    /** Baut das Menü-Inventar mit genau zwei Auswahl-Feldern: Spawn und Cores. */
    public static Inventory erstelleMenue() {
        // 9 Felder = eine Reihe. null = das Inventar hat keinen "Besitzer".
        Inventory menue = Bukkit.createInventory(null, 9, TITEL);

        // Feld 3 (4. von links): Spawn, dargestellt als Smaragd.
        menue.setItem(3, feld(Material.EMERALD, SPAWN_NAME));
        // Feld 5 (6. von links): Cores, dargestellt als Leuchtfeuer.
        menue.setItem(5, feld(Material.BEACON, CORES_NAME));

        return menue;
    }

    /** Kleine Hilfsfunktion: erstellt ein Item mit einem Anzeigenamen. */
    private static ItemStack feld(Material material, String name) {
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.setDisplayName(name);
        item.setItemMeta(meta);
        return item;
    }
}
