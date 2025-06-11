import { describe, it, vi, expect, beforeEach } from "vitest";
import { ChannelType, Client, Collection, Guild, GuildTextBasedChannel, Message, User } from "discord.js";
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
vi.mock("@lib", () => ({
  logger: { log: vi.fn() },
}));
import { getBumpLeaderboard, getGuildConfig } from "@database";
vi.mock("@database");
import { bumpLeaderboard } from "@utils";
const createMockClient = () =>
  ({
    guilds: {
      cache: new Collection<string, Guild>(),
    },
    users: {
      fetch: vi.fn(),
    },
    i18next: {
      getFixedT: () => (key: string) => key, // Mock translation function
    },
    user: {
      id: "123456789012",
    },
  }) as unknown as Client;

const createMockGuild = (id: string) =>
  ({
    id,
    channels: {
      cache: new Collection<string, GuildTextBasedChannel>(),
    },
  }) as unknown as Guild;

const createMockChannel = (id: string, message?: Message<true>) =>
  ({
    id,
    type: ChannelType.GuildText,
    messages: {
      fetch: vi.fn().mockResolvedValue({
        first: () => message,
      }),
      cache: new Collection<string, Message<true>>(),
    },
    send: vi.fn(),
  }) as unknown as GuildTextBasedChannel;

const createMockMessage = (id: string, authorId: string) =>
  ({
    id,
    author: { id: authorId },
    edit: vi.fn(),
  }) as unknown as Message<true>;

describe("bumpLeaderboard", () => {
  it("should return if no guild is found", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const result = await bumpLeaderboard(client, guildId);
    expect(result).toBeUndefined();
  });
  it("should return if no guild config is found", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return undefined
    vi.mocked(getGuildConfig).mockResolvedValue(null);
    const result = await bumpLeaderboard(client, guildId);
    expect(result).toBeUndefined();
  });
  it("should return if no bump leaderboard channel is found", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return a valid config without a channel
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("12121212121"),
    });
    const result = await bumpLeaderboard(client, guildId);
    expect(result).toBeUndefined();
  });
  it("should return if there's no bumps", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    const mockChannel = createMockChannel("987654321098765432");
    client.guilds.cache.set(guildId, mockGuild);
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    // Mock getGuildConfig to return a valid config
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([]);
    const result = await bumpLeaderboard(client, guildId);
    expect(result).toBeUndefined();
  });
  it("should return a error message if the message is not sent by the bot", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);
    const mockMessage = createMockMessage("messageId", "123456789012345678");
    const mockChannel = createMockChannel("987654321098765432", mockMessage);
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    // Mock getGuildConfig to return a valid config
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([
      { user_id: BigInt("123456789012345678"), bump_count: 5, guild_id: BigInt(guildId) },
    ]);
    const result = await bumpLeaderboard(client, guildId);
    expect(result).toEqual({ error: "message_not_sent_by_bot" });
  });
  it("should edit the existing message with the leaderboard", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return a valid config
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([
      { user_id: BigInt("123456789012345678"), bump_count: 5, guild_id: BigInt(guildId) },
    ]);
    const mockMessage = createMockMessage("messageId", client.user?.id || "123");
    const mockChannel = createMockChannel("987654321098765432", mockMessage);
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    await bumpLeaderboard(client, guildId);
    expect(mockMessage.edit).toHaveBeenCalled();
    expect(mockChannel.send).not.toHaveBeenCalled();
  });
  it("should add a last bump message if lastBump is provided", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return a valid config
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([
      { user_id: BigInt("123456789012345678"), bump_count: 5, guild_id: BigInt(guildId) },
    ]);
    const mockMessage = createMockMessage("messageId", client.user?.id || "123");
    const mockChannel = createMockChannel("987654321098765432", mockMessage);
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    const lastBump = { id: "123456789012345678", toString: () => "<@123456789012345678>" };
    await bumpLeaderboard(client, guildId, lastBump as User);
    expect(mockMessage.edit).toHaveBeenCalledWith(expect.stringContaining("last_bump"));
  });
  it("should add a last winner message if last_bump_winner is set in guild config", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return a valid config with last_bump_winner
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
      last_bump_winner: "123456789012345678",
      last_bump_winner_count: 10,
      last_bump_winner_total_count: 50,
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([
      { user_id: BigInt("123456789012345678"), bump_count: 5, guild_id: BigInt(guildId) },
    ]);
    const mockMessage = createMockMessage("messageId", client.user?.id || "123");
    const mockChannel = createMockChannel("987654321098765432", mockMessage);
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    await bumpLeaderboard(client, guildId);
    expect(mockMessage.edit).toHaveBeenCalledWith(expect.stringContaining("last_winner"));
  });
  it("should send a new message if no existing message is found", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return a valid config
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([
      { user_id: BigInt("123456789012345678"), bump_count: 5, guild_id: BigInt(guildId) },
    ]);
    const mockChannel = createMockChannel("987654321098765432");
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    await bumpLeaderboard(client, guildId);
    expect(mockChannel.send).toHaveBeenCalled();
  });
  it("should send a new message with lastBump if provided", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return a valid config
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([
      { user_id: BigInt("123456789012345678"), bump_count: 5, guild_id: BigInt(guildId) },
    ]);
    const mockChannel = createMockChannel("987654321098765432");
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    const lastBump = { id: "123456789012345678", toString: () => "<@123456789012345678>" };
    await bumpLeaderboard(client, guildId, lastBump as User);
    expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining("last_bump"));
  });
  it("should send a new message with last winner if last_bump_winner is set in guild config", async () => {
    const client = createMockClient();
    const guildId = "123456789012345678";
    const mockGuild = createMockGuild(guildId);
    client.guilds.cache.set(guildId, mockGuild);

    // Mock getGuildConfig to return a valid config with last_bump_winner
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      bump_leaderboard_channel_id: BigInt("987654321098765432"),
      last_bump_winner: "123456789012345678",
      last_bump_winner_count: 10,
      last_bump_winner_total_count: 50,
    });
    vi.mocked(getBumpLeaderboard).mockResolvedValue([
      { user_id: BigInt("123456789012345678"), bump_count: 5, guild_id: BigInt(guildId) },
    ]);
    const mockChannel = createMockChannel("987654321098765432");
    client.guilds.cache.get(guildId)?.channels.cache.set("987654321098765432", mockChannel);
    await bumpLeaderboard(client, guildId);
    expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining("last_winner"));
  });
});
