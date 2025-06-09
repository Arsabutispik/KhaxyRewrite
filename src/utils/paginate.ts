import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

/**
 * Paginates through a list of embeds with buttons for navigation.
 * @param message - The interaction message to reply to.
 * @param pages - An array of EmbedBuilder objects to paginate through.
 * @param timeout - The time in milliseconds before the pagination times out (default is 60000ms).
 */
export async function paginate(
  message: ChatInputCommandInteraction<"cached">,
  pages: EmbedBuilder[],
  timeout: number = 60000,
) {
  if (!message) throw new Error("Channel is inaccessible.");
  if (!pages) throw new Error("Pages are not given.");
  const nextPage = new ButtonBuilder()
    .setCustomId("next")
    .setEmoji("▶️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const prevPage = new ButtonBuilder()
    .setCustomId("prev")
    .setEmoji("◀️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const lastPage = new ButtonBuilder()
    .setCustomId("last")
    .setEmoji("⏩")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const firstPage = new ButtonBuilder()
    .setCustomId("first")
    .setEmoji("⏪")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const closePage = new ButtonBuilder()
    .setCustomId("close")
    .setEmoji("✖️")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(false);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([lastPage, nextPage, closePage, prevPage, firstPage]);
  let page = 0;
  await message.reply({
    embeds: [pages[page]],
    components: [row],
  });
  const currPage = await message.fetchReply();
  const filter = (button: ButtonInteraction) =>
    button.user.id === message.user.id &&
    (button.customId === "next" ||
      button.customId === "prev" ||
      button.customId === "close" ||
      button.customId === "first" ||
      button.customId === "last");
  const collector = currPage.createMessageComponentCollector({
    filter,
    time: timeout,
    componentType: ComponentType.Button,
  });
  collector.on("collect", async (button) => {
    if (button.customId === "close") return collector.stop();
    if (button.customId === "prev") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = page > 0 ? --page : pages.length - 1;
    } else if (button.customId === "next") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = page + 1 < pages.length ? ++page : 0;
    } else if (button.customId === "first") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = 0;
    } else if (button.customId === "last") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = pages.length - 1;
    }
    await currPage.edit({
      embeds: [pages[page]],
      components: [row],
    });
  });
  collector.on("end", async () => {
    await currPage.edit({ components: [] });
  });
}
