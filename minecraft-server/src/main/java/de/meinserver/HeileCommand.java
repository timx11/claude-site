package de.meinserver;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

/**
 * Reagiert auf den Befehl /heile und stellt Leben + Hunger wieder her.
 */
public class HeileCommand implements CommandExecutor {

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // Prüfen, ob der Befehl von einem Spieler kommt.
        // Die Konsole hat keinen Körper, den man heilen könnte.
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Diesen Befehl kann nur ein Spieler benutzen.");
            return true;
        }

        // sender in einen Player umwandeln, um Spieler-Funktionen zu nutzen.
        Player spieler = (Player) sender;

        // Leben auffüllen. 20.0 ist der Standard-Maximalwert (10 Herzen).
        spieler.setHealth(20.0);
        // Hunger-Anzeige auf voll setzen (20 = volle Leiste).
        spieler.setFoodLevel(20);

        spieler.sendMessage(ChatColor.GREEN + "Du wurdest vollständig geheilt!");
        return true;
    }
}
