package de.meinserver;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;

/**
 * Reagiert auf den Befehl /hallo.
 * Eine Befehls-Klasse muss "CommandExecutor" umsetzen
 * und die Methode onCommand anbieten.
 */
public class HalloCommand implements CommandExecutor {

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // "sender" ist derjenige, der den Befehl ausgeführt hat
        // (ein Spieler oder die Server-Konsole).
        // ChatColor.GREEN färbt den Text grün ein.
        sender.sendMessage(ChatColor.GREEN + "Hallo und willkommen auf MeinServer!");

        // true bedeutet: Befehl wurde erfolgreich verarbeitet.
        return true;
    }
}
