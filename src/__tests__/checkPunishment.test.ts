import { describe, it, vi, expect, beforeEach } from "vitest";
import { Client, Collection, Guild, GuildBan, GuildMember, Role, User } from "discord.js";
import dayjs from "dayjs";
import { PunishmentType } from "@constants";
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
// Mock modules
import { logger } from "@lib";
vi.mock("@lib", () => ({
  logger: { log: vi.fn() },
}));
import { deleteExpiredPunishments, getExpiredPunishments, getGuildConfig } from "@database";
vi.mock("@database");
import { checkPunishments } from "@utils";
const createMockClient = () =>
  ({
    guilds: {
      cache: new Map(),
    },
    users: {
      fetch: vi.fn(),
    },
    i18next: {
      getFixedT: () => (key: string) => key,
    },
  }) as unknown as Client;
const createMockGuild = (id: string) =>
  ({
    id,
    name: `Mock Guild ${id}`,
    members: {
      fetch: vi.fn(),
      unban: vi.fn(),
      cache: new Map(),
    },
    bans: {
      cache: new Map(),
    },
    roles: {
      cache: new Collection<string, Role>(),
    },
  }) as unknown as Guild;
const createMockUser = (id: string) =>
  ({
    id,
    tag: `Mock User ${id}#1234`,
  }) as unknown as User;
describe("checkPunishments", () => {
  it("should unban a user with an expired ban punishment", async () => {
    const mockClient = createMockClient();
    const mockGuild = createMockGuild("123");
    mockClient.guilds.cache.set(mockGuild.id, mockGuild);
    const mockUser = createMockUser("456");
    const mockGuildBan = {
      user: mockUser,
      guild: mockGuild,
    } as unknown as GuildBan;
    mockGuild.bans.cache.set(mockUser.id, mockGuildBan);
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) => {
      if (id === "456") return mockUser;
      if (id === "789") return { id: "789" } as User; // Mock staff user
      return null;
    });
    vi.mocked(getExpiredPunishments).mockResolvedValue([
      {
        guild_id: BigInt("123"),
        user_id: BigInt("456"),
        staff_id: BigInt("789"),
        expires_at: dayjs().subtract(1, "hour").toDate(),
        created_at: dayjs().subtract(2, "hour").toDate(),
        type: PunishmentType.BAN,
        previous_roles: [],
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({ language: "en" });
    await checkPunishments(mockClient);
    expect(mockGuild.members.unban).toHaveBeenCalledWith(mockUser, "commands:ban.expired");
    expect(deleteExpiredPunishments).toHaveBeenCalled();
  });
  it("should unmute a user with an expired mute punishment", async () => {
    const mockClient = createMockClient();
    const mockGuild = createMockGuild("123");
    mockClient.guilds.cache.set("123", mockGuild);
    const mockUser = createMockUser("456");
    mockGuild.members.cache.set("456", {
      roles: {
        cache: new Collection().set("444", { id: "444" } as Role),
        add: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn(function (this: { cache: Collection<string, Role> }, roleId: string) {
          this.cache.delete(roleId);
          return Promise.resolve();
        }),
      },
      guild: mockGuild,
    } as unknown as GuildMember);
    mockGuild.roles.cache.set("444", { id: "444" } as unknown as Role);
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) => {
      if (id === "456") return mockUser;
      if (id === "789") return { id: "789" } as User; // Mock staff user
      return null;
    });
    vi.mocked(getExpiredPunishments).mockResolvedValue([
      {
        guild_id: BigInt("123"),
        user_id: BigInt("456"),
        staff_id: BigInt("789"),
        expires_at: dayjs().subtract(1, "hour").toDate(),
        created_at: dayjs().subtract(2, "hour").toDate(),
        type: PunishmentType.MUTE,
        previous_roles: [],
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({ mute_role_id: BigInt("444"), language: "en" });
    await checkPunishments(mockClient);
    expect(mockGuild.members.cache.get("456")?.roles?.cache?.has("444")).toBe(false);
    expect(deleteExpiredPunishments).toHaveBeenCalled();
  });
  it("should log an error if guild not found in cache", async () => {
    const mockClient = createMockClient();
    vi.mocked(getExpiredPunishments).mockResolvedValue([
      {
        guild_id: BigInt("123"),
        user_id: BigInt("456"),
        staff_id: BigInt("789"),
        expires_at: dayjs().subtract(1, "hour").toDate(),
        created_at: dayjs().subtract(2, "hour").toDate(),
        type: PunishmentType.BAN,
        previous_roles: [],
      },
    ]);
    await checkPunishments(mockClient);
    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `Guild 123 not found in cache`,
      discord: false,
    });
  });
  it("should log a warning if guild config data not found", async () => {
    const mockClient = createMockClient();
    const mockGuild = createMockGuild("123");
    mockClient.guilds.cache.set("123", mockGuild);
    vi.mocked(getExpiredPunishments).mockResolvedValue([
      {
        guild_id: BigInt("123"),
        user_id: BigInt("456"),
        staff_id: BigInt("789"),
        expires_at: dayjs().subtract(1, "hour").toDate(),
        created_at: dayjs().subtract(2, "hour").toDate(),
        type: PunishmentType.BAN,
        previous_roles: [],
      },
    ]);
    vi.mocked(getGuildConfig).mockResolvedValue(null); // Simulate no config found
    await checkPunishments(mockClient);
    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `Guild 123 not found in database`,
      discord: false,
    });
  });
  it("should log a warning if user is not banned in guild", async () => {
    const mockClient = createMockClient();
    const mockGuild = createMockGuild("123");
    const mockUser = createMockUser("456");
    mockClient.guilds.cache.set("123", mockGuild);
    mockClient.guilds.cache.set(mockGuild.id, mockGuild);
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) => {
      if (id === "456") return mockUser;
      if (id === "789") return { id: "789" } as User; // Mock staff user
      return null;
    });
    vi.mocked(getExpiredPunishments).mockResolvedValue([
      {
        guild_id: BigInt("123"),
        user_id: BigInt("456"),
        staff_id: BigInt("789"),
        expires_at: dayjs().subtract(1, "hour").toDate(),
        created_at: dayjs().subtract(2, "hour").toDate(),
        type: PunishmentType.BAN,
        previous_roles: [],
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({ language: "en" });
    await checkPunishments(mockClient);
    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `User ${mockUser.tag} is not banned in guild ${mockGuild.name}`,
      discord: false,
    });
  });
  it("should log a warning if member not found for mute punishment", async () => {
    const mockClient = createMockClient();
    const mockGuild = createMockGuild("123");
    const mockUser = createMockUser("456");
    mockClient.guilds.cache.set("123", mockGuild);
    vi.mocked(getExpiredPunishments).mockResolvedValue([
      {
        guild_id: BigInt("123"),
        user_id: BigInt("456"),
        staff_id: BigInt("789"),
        expires_at: dayjs().subtract(1, "hour").toDate(),
        created_at: dayjs().subtract(2, "hour").toDate(),
        type: PunishmentType.MUTE,
        previous_roles: [],
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({ mute_role_id: BigInt("444"), language: "en" });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) => {
      if (id === "456") return mockUser;
      if (id === "789") return { id: "789" } as User; // Mock staff user
      return null;
    });
    await checkPunishments(mockClient);
    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `Member ${mockUser.tag} not found in guild ${mockGuild.name}`,
      discord: false,
    });
  });
  it("should give back previous roles to a muted user", async () => {
    const mockClient = createMockClient();
    const mockGuild = createMockGuild("123");
    mockGuild.roles.cache.set("3343", { id: "3343" } as unknown as Role); // Mock a role that will be restored
    mockGuild.roles.cache.set("456", { id: "456" } as unknown as Role); // Mock mute role
    const mockMember = {
      ...createMockUser("456"),
      roles: {
        cache: new Collection<string, Role>().set("456", { id: "456" } as Role),
        add: vi.fn(function (this: { cache: Collection<string, Role> }, roleId: string) {
          const roleIds = Array.isArray(roleId) ? roleId : [roleId];
          for (const id of roleIds) {
            this.cache.set(id, { id } as Role);
          }
        }),
        remove: vi.fn(function (this: { cache: Collection<string, Role> }, roleId: string) {
          const roleIds = Array.isArray(roleId) ? roleId : [roleId];
          for (const id of roleIds) {
            this.cache.delete(id);
          }
        }),
      },
      guild: mockGuild,
    } as unknown as GuildMember;
    vi.mocked(getExpiredPunishments).mockResolvedValue([
      {
        guild_id: BigInt("123"),
        user_id: BigInt("456"),
        staff_id: BigInt("789"),
        expires_at: dayjs().subtract(1, "hour").toDate(),
        created_at: dayjs().subtract(2, "hour").toDate(),
        type: PunishmentType.MUTE,
        previous_roles: [BigInt("3343")],
      },
    ]);
    vi.mocked(getGuildConfig, { partial: true }).mockResolvedValue({
      mute_role_id: BigInt("456"),
      language: "en",
    });
    mockClient.guilds.cache.set("123", mockGuild);
    mockGuild.members.fetch = vi.fn().mockResolvedValue(mockMember);
    mockGuild.members.cache.set("456", mockMember);

    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? ({ id: "456", tag: "User#1234" } as User) : ({ id: "789" } as User),
    );

    await checkPunishments(mockClient);

    expect(mockMember.roles.cache.has("3343")).toBe(true); // to add previous roles
    expect(mockMember.roles.cache.has("456")).toBe(false); // to remove muteRole
  });
  it("should remove roles from previous_roles if role not found in guild roles cache", async () => {
    const mockClient = createMockClient();
    const mockGuild = createMockGuild("123");
    const mockMember = {
      ...createMockUser("456"),
      roles: {
        cache: new Collection<string, Role>().set("444", { id: "444" } as Role),
        add: vi.fn(function (this: { cache: Collection<string, Role> }, roleId: string) {
          const roleIds = Array.isArray(roleId) ? roleId : [roleId];
          for (const id of roleIds) {
            this.cache.set(id, { id } as Role);
          }
        }),
        remove: vi.fn(function (this: { cache: Collection<string, Role> }, roleId: string) {
          const roleIds = Array.isArray(roleId) ? roleId : [roleId];
          for (const id of roleIds) {
            this.cache.delete(id);
          }
        }),
      },
      guild: mockGuild,
    } as unknown as GuildMember;
    mockClient.guilds.cache.set("123", mockGuild);
    mockGuild.members.cache.set("456", mockMember);
    const punishment = {
      guild_id: BigInt("123"),
      user_id: BigInt("456"),
      staff_id: BigInt("789"),
      expires_at: dayjs().subtract(1, "hour").toDate(),
      created_at: dayjs().subtract(2, "hour").toDate(),
      type: PunishmentType.MUTE,
      previous_roles: [BigInt("444"), BigInt("555")], // "555" does not exist
    };
    vi.mocked(getExpiredPunishments).mockResolvedValue([punishment]);
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? ({ id: "456", tag: "User#1234" } as User) : ({ id: "789" } as User),
    );
    await checkPunishments(mockClient);

    // After checkPunishments, "555" should be removed from previous_roles
    expect(punishment.previous_roles).not.toContain(BigInt("555"));
  });
});
