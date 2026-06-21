package de.meinserver;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

/**
 * Verarbeitet /setspawn und /setcores.
 * Speichert die aktuelle Position des Spielers als Spawn- bzw. Cores-Ort.
 */
public class OrtCommand implements CommandExecutor {

    private final MeinServerPlugin plugin;

    public OrtCommand(MeinServerPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // Nur Spieler haben eine Position im Spiel.
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Nur ein Spieler kann einen Ort setzen.");
            return true;
        }
        Player spieler = (Player) sender;

        // Sicherheit: nur Operatoren (Admins) dürfen Orte setzen.
        if (!spieler.isOp()) {
            spieler.sendMessage(ChatColor.RED + "Dazu hast du keine Rechte.");
            return true;
        }

        // command.getName() ist der echte Befehlsname (setspawn oder setcores).
        String name = command.getName().toLowerCase();
        if (name.equals("setspawn")) {
            plugin.setSpawn(spieler.getLocation());
            spieler.sendMessage(ChatColor.GREEN + "Spawn wurde auf deine Position gesetzt.");
        } else if (name.equals("setcores")) {
            plugin.setCores(spieler.getLocation());
            spieler.sendMessage(ChatColor.GREEN + "Cores wurde auf deine Position gesetzt.");
        }
        return true;
    }
}
