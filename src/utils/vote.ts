import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonComponent,
  ButtonStyle,
  ChatInputCommandInteraction,
  Collection,
  ComponentType,
  GuildMember,
  Message,
  MessageComponentInteraction,
  MessageFlags,
} from "discord.js";
import { TFunction } from "i18next";
import { getGuildConfig } from "@database";

/**
 * Handles the voting process for a message.
 * @param interaction - The interaction object.
 * @param users - The collection of users who can vote.
 * @param message - The message to be voted on.
 * @returns A boolean indicating whether the voting was successful.
 */
export async function vote(
  interaction: ChatInputCommandInteraction<"cached">,
  users: Collection<string, GuildMember>,
  message: Message,
): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not configured yet.",
        flags: MessageFlags.Ephemeral,
      });
      reject();
      return;
    }
    const validButtonIds = ["accept", "reject"];

    let allButtons = message.components
      .filter((rows) => rows.type === ComponentType.ActionRow)
      .flatMap((row) => row.components)
      .filter((comp) => comp.type === ComponentType.Button);

    const buttonIds = allButtons.map((btn) => (btn as ButtonComponent).customId);
    // If buttons are incorrect or missing, auto-generate them
    const needsFixing = buttonIds.length !== 2 || !validButtonIds.every((id) => buttonIds.includes(id));

    if (needsFixing) {
      const acceptButton = new ButtonBuilder()
        .setCustomId("accept")
        .setEmoji(interaction.client.allEmojis.get(interaction.client.config.Emojis.confirm)!.format)
        .setStyle(ButtonStyle.Success);

      const rejectButton = new ButtonBuilder()
        .setCustomId("reject")
        .setEmoji(interaction.client.allEmojis.get(interaction.client.config.Emojis.reject)!.format)
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButton, rejectButton);

      await message.edit({ components: [row] });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, null, "vote");
    const totalUsers = users.size;

    let requiredVotes: number;
    if (totalUsers <= 2) {
      // For 1 or 2 people, just 1 vote needed
      requiredVotes = 1;
    } else {
      // Otherwise, 60% rounded up
      requiredVotes = Math.ceil(totalUsers * 0.6);
    }
    let yesVotes = 0;
    let noVotes = 0;
    let votedUsers = 0;
    await message.edit(
      generateVoteEmbed({
        totalUsers: users.size,
        requiredVotes,
        votedUsers,
        yesVotes,
        noVotes,
        t,
      }),
    );
    const data = users.map((user) => ({ id: user.id, voted: false, vote: false }));
    const filter = (i: MessageComponentInteraction) => users.has(i.user.id);
    const collector = message.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 1000 * 60 * 5,
    });
    collector.on("ignore", async (collected) => {
      await collected.reply({ content: t("not_eligible"), flags: MessageFlags.Ephemeral });
    });
    collector.on("collect", async (collected) => {
      const user = users.get(collected.user.id);
      if (!user) return;
      const userVote = data.find((d) => d.id === collected.user.id);
      if (!userVote) return;
      if (userVote.voted) {
        await collected.reply({ content: t("already_voted"), flags: MessageFlags.Ephemeral });
        return;
      }
      if (collected.customId === "accept") {
        userVote.vote = true;
        yesVotes++;
        await collected.reply({ content: t("voted_yes"), flags: MessageFlags.Ephemeral });
      } else if (collected.customId === "reject") {
        userVote.vote = false;
        noVotes++;
        await collected.reply({ content: t("voted_no"), flags: MessageFlags.Ephemeral });
      }
      userVote.voted = true;
      votedUsers++;
      await message.edit(
        generateVoteEmbed({
          totalUsers: users.size,
          requiredVotes,
          votedUsers,
          yesVotes,
          noVotes,
          t,
        }),
      );
      const currentYesVotes = data.filter((d) => d.vote).length;
      if (currentYesVotes >= requiredVotes) {
        collector.stop();
      }
      if (data.every((d) => d.voted)) {
        collector.stop();
      }
    });
    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await interaction.followUp({ content: t("no_votes"), flags: MessageFlags.Ephemeral });
        return;
      }
      const votes = data.filter((d) => d.voted);
      const yesVotes = votes.filter((d) => d.vote).length;
      resolve(yesVotes >= requiredVotes);
    });
  });
}
function generateVoteEmbed({
  totalUsers,
  requiredVotes,
  votedUsers,
  yesVotes,
  noVotes,
  t,
}: {
  totalUsers: number;
  requiredVotes: number;
  votedUsers: number;
  yesVotes: number;
  noVotes: number;
  t: TFunction;
}) {
  return {
    embeds: [
      {
        title: t("embed.title"),
        description: t("embed.description", {
          totalUsers,
          requiredVotes,
          votedUsers,
          yesVotes,
          noVotes,
        }),
        color: 0x00b0f4,
        fields: [
          { name: t("embed.fields.yes"), value: `${yesVotes}`, inline: true },
          { name: t("embed.fields.no"), value: `${noVotes}`, inline: true },
          { name: t("embed.fields.voted"), value: `${votedUsers}/${totalUsers}`, inline: true },
          { name: t("embed.fields.required"), value: `${requiredVotes}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
