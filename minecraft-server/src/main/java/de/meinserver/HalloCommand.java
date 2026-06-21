package de.meinserver;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
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
        sender.sendMessage(
                Component.text("Hallo und willkommen auf MeinServer!", NamedTextColor.GREEN)
        );

        // true bedeutet: Befehl wurde erfolgreich verarbeitet.
        return true;
    }
}
