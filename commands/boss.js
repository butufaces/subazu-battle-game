import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { bosses } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('boss')
  .setDescription('View the current world boss');

export async function execute(interaction) {
  const boss = bosses[Math.floor(Math.random() * bosses.length)];

  const embed = new EmbedBuilder()
    .setTitle(`👹 ${boss.name}`)
    .setDescription(boss.lore)
    .addFields(
      { name: 'Reward Multiplier', value: `${boss.multiplier}x`, inline: true },
      {
        name: 'Threat Level',
        value: boss.multiplier >= 2 ? '☠️ High' : '⚠️ Medium',
        inline: true
      }
    )
    .setImage(boss.imageURL)
    .setColor(0x8b0000);

  return interaction.reply({ embeds: [embed] });
}
