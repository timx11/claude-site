package de.meinserver;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
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
        if (!(sender instanceof Player spieler)) {
            sender.sendMessage(
                    Component.text("Diesen Befehl kann nur ein Spieler benutzen.", NamedTextColor.RED)
            );
            return true;
        }

        // Leben auffüllen. 20.0 ist der Standard-Maximalwert (10 Herzen).
        spieler.setHealth(20.0);
        // Hunger-Anzeige auf voll setzen (20 = volle Leiste).
        spieler.setFoodLevel(20);

        spieler.sendMessage(
                Component.text("Du wurdest vollständig geheilt!", NamedTextColor.GREEN)
        );
        return true;
    }
}
