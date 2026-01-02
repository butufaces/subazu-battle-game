import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show bot commands');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('📖 Commands')
    .setDescription(
      [
        '`/wallet <address>` – Register or update wallet',
        '`/trial` – Play the 3-round battle',
        '`/profile` – View your stats',
        '`/leaderboard` – Top players',
        '`/boss` – View the world boss',
        '',
        '**Admin**',
        '`/admin-setcooldown <hours>` – Set cooldown',
        '`/admin-setwin <value>` – Set base win chance'
      ].join('\n')
    );

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
