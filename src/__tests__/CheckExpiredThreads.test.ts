import { describe, it, vi, beforeEach, expect } from "vitest";
import { ChannelType, Client, Collection, Guild, GuildTextBasedChannel, Message, User } from "discord.js";

beforeEach(() => {
  vi.clearAllMocks();
});
vi.mock("@lib", () => ({
  logger: { log: vi.fn() },
}));
import { getExpiredModMailThreads, getGuildConfig } from "@database";
vi.mock("@database");
vi.mock("@utils", async (importOriginal) => ({
  ...(await importOriginal()),
  modMailLog: vi.fn(),
}));
import { checkExpiredThreads } from "@utils";
import dayjs from "dayjs";
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
const createMockChannel = (id: string, message?: Message<true>, guild?: Guild) =>
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
    guild,
  }) as unknown as GuildTextBasedChannel;
const createMockUser = (id: string) =>
  ({
    id,
    tag: `Mock User ${id}#1234`,
    send: vi.fn(),
  }) as unknown as User;
describe("CheckExpiredThreads", () => {
  it("should process expired threads and call expected functions", async () => {
    const client = createMockClient();
    const guild = createMockGuild("123456789012");
    client.guilds.cache.set(guild.id, guild);
    const channel = createMockChannel("123456789014", undefined, guild);
    guild.channels.cache.set(channel.id, channel);
    const mockUser = createMockUser("123456789013");
    const mockCloser = createMockUser("123456789015");
    client.users.fetch = vi.fn().mockImplementation((id: string) => {
      if (id === mockUser.id) return Promise.resolve(mockUser);
      if (id === mockCloser.id) return Promise.resolve(mockCloser);
      return Promise.reject(new Error("User not found"));
    });
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      language: "en",
    });
    vi.mocked(getExpiredModMailThreads, { partial: true }).mockResolvedValue([
      {
        id: BigInt(1),
        guild_id: BigInt(guild.id),
        channel_id: BigInt(channel.id),
        user_id: BigInt(mockUser.id),
        closer_id: BigInt(mockCloser.id),
        close_date: null,
        created_at: dayjs().subtract(1, "day").toDate(),
        closed_at: new Date(),
        status: "open",
      },
    ]);
    await checkExpiredThreads(client);
    expect(channel.send).toHaveBeenCalledWith("preparing_close");
    expect(mockUser.send).toHaveBeenCalledWith("thread_closed_dm");
  });
  it("should handle case where guild is not found", async () => {
    const client = createMockClient();
    vi.mocked(getExpiredModMailThreads, { partial: true }).mockResolvedValue([
      {
        id: BigInt(1),
        guild_id: BigInt("999999999999"), // Non-existent guild
        channel_id: BigInt("123456789014"),
        user_id: BigInt("123456789013"),
        closer_id: BigInt("123456789015"),
        close_date: null,
        created_at: dayjs().subtract(1, "day").toDate(),
        closed_at: new Date(),
        status: "open",
      },
    ]);
    await checkExpiredThreads(client);
    expect(client.guilds.cache.get("999999999999")).toBeUndefined();
  });
  it("should handle case where guild config is not found", async () => {
    const client = createMockClient();
    const guild = createMockGuild("123456789012");
    client.guilds.cache.set(guild.id, guild);
    const channel = createMockChannel("123456789014", undefined, guild);
    guild.channels.cache.set(channel.id, channel);
    client.users.fetch = vi.fn().mockResolvedValue(createMockUser("123456789013"));
    vi.mocked(getExpiredModMailThreads, { partial: true }).mockResolvedValue([
      {
        id: BigInt(1),
        guild_id: BigInt(guild.id),
        channel_id: BigInt(channel.id),
        user_id: BigInt("123456789013"),
        closer_id: BigInt("123456789015"),
        close_date: null,
        created_at: dayjs().subtract(1, "day").toDate(),
        closed_at: new Date(),
        status: "open",
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue(null);
    await checkExpiredThreads(client);
    expect(channel.send).not.toHaveBeenCalled();
  });
  it("should handle case where channel is not found", async () => {
    const client = createMockClient();
    const guild = createMockGuild("123456789012");
    client.guilds.cache.set(guild.id, guild);
    vi.mocked(getExpiredModMailThreads, { partial: true }).mockResolvedValue([
      {
        id: BigInt(1),
        guild_id: BigInt(guild.id),
        channel_id: BigInt("999999999999"), // Non-existent channel
        user_id: BigInt("123456789013"),
        closer_id: BigInt("123456789015"),
        close_date: null,
        created_at: dayjs().subtract(1, "day").toDate(),
        closed_at: new Date(),
        status: "open",
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      language: "en",
    });
    await checkExpiredThreads(client);
    expect(guild.channels.cache.get("999999999999")).toBeUndefined();
  });
  it("should handle case where user is not found", async () => {
    const client = createMockClient();
    const guild = createMockGuild("123456789012");
    client.guilds.cache.set(guild.id, guild);
    const channel = createMockChannel("123456789014", undefined, guild);
    guild.channels.cache.set(channel.id, channel);
    vi.mocked(getExpiredModMailThreads, { partial: true }).mockResolvedValue([
      {
        id: BigInt(1),
        guild_id: BigInt(guild.id),
        channel_id: BigInt(channel.id),
        user_id: BigInt("999999999999"), // Non-existent user
        closer_id: BigInt("123456789015"),
        close_date: null,
        created_at: dayjs().subtract(1, "day").toDate(),
        closed_at: new Date(),
        status: "open",
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      language: "en",
    });
    client.users.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error("User not found")));
    await checkExpiredThreads(client);
    expect(client.users.fetch).toHaveBeenCalledWith("999999999999");
  });
});
