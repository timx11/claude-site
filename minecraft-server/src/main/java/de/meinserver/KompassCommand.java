package de.meinserver;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

/**
 * Reagiert auf /kompass und gibt dem Spieler den Menü-Kompass erneut.
 * Praktisch, falls er ihn verloren hat.
 */
public class KompassCommand implements CommandExecutor {

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Diesen Befehl kann nur ein Spieler benutzen.");
            return true;
        }
        Player spieler = (Player) sender;
        spieler.getInventory().addItem(KompassMenue.erstelleKompass());
        spieler.sendMessage(ChatColor.GREEN + "Du hast den Menü-Kompass erhalten. (Rechtsklick öffnet das Menü)");
        return true;
    }
}
