import { describe, it, vi, beforeEach, expect } from "vitest";
import * as utils from "@utils";
import { deleteExpiredPunishments, getExpiredPunishments, getGuildConfig } from "@database";
import { Client, Guild, GuildMember, User } from "discord.js";
import dayjs from "dayjs";
import { PunishmentType } from "@constants";
beforeEach(() => {
  vi.clearAllMocks();
});
// Mock modules
vi.mock("@database");
import { logger } from "@lib";
vi.mock("@lib", () => ({
  logger: { log: vi.fn() },
}));
vi.spyOn(utils, "modLog").mockImplementation(vi.fn());

const createMockClient = () =>
  ({
    guilds: {
      cache: new Map(),
    },
    users: {
      fetch: vi.fn(),
    },
    i18next: {
      getFixedT: () => () => "Ban expired",
    },
  }) as unknown as Client;

describe("checkPunishments", () => {
  it("should unban a user with an expired ban punishment", async () => {
    const mockClient = createMockClient();

    const mockGuild = {
      id: "123",
      name: "Test Guild",
      members: {
        fetch: vi.fn(),
        unban: vi.fn(),
      },
      bans: {
        cache: new Map([["456", { user: { id: "456", tag: "User#1234" } }]]),
      },
      roles: {
        cache: new Map(),
      },
    } as unknown as Guild;

    const mockUser = { id: "456", tag: "User#1234" } as User;
    const mockStaff = { id: "789" } as User;

    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.BAN,
      },
    ]);
    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ language: "en" });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? mockUser : mockStaff,
    );
    mockClient.guilds.cache.set("123", mockGuild);

    await utils.checkPunishments(mockClient);
    expect(mockGuild.members.unban).toHaveBeenCalledWith(mockUser, "Ban expired");
    expect(utils.modLog).toHaveBeenCalled();
    expect(deleteExpiredPunishments).toHaveBeenCalled();
  });
  it("should unmute a user with an expired mute punishment", async () => {
    const mockClient = createMockClient();

    const mockGuild = {
      id: "123",
      name: "Test Guild",
      members: {
        fetch: vi.fn(),
        cache: new Map([["456", { roles: { cache: new Map() } }]]),
      },
      bans: {
        cache: new Map(),
      },
      roles: {
        cache: new Map([["muteRole", { id: "muteRole" }]]),
      },
    } as unknown as Guild;

    const mockUser = { id: "456", tag: "User#1234" } as User;
    const mockStaff = { id: "789" } as User;

    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.MUTE,
      },
    ]);
    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ language: "en" });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? mockUser : mockStaff,
    );
    mockClient.guilds.cache.set("123", mockGuild);

    await utils.checkPunishments(mockClient);
    expect(mockGuild.members.cache.get("456")?.roles.cache.has("muteRole")).toBe(false);
    expect(deleteExpiredPunishments).toHaveBeenCalled();
  });
  it("should log an error if guild not found in cache", async () => {
    const mockClient = createMockClient();

    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.BAN,
      },
    ]);
    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ language: "en" });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? ({ id: "456", tag: "User#1234" } as User) : ({ id: "789" } as User),
    );

    await utils.checkPunishments(mockClient);
    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `Guild 123 not found in cache`,
      discord: false,
    });
  });
  it("should log a warning if guild config data not found", async () => {
    const mockClient = createMockClient();

    const mockGuild = {
      id: "123",
      name: "Test Guild",
      members: {
        fetch: vi.fn(),
        unban: vi.fn(),
      },
      bans: {
        cache: new Map(),
      },
      roles: {
        cache: new Map(),
      },
    } as unknown as Guild;

    mockClient.guilds.cache.set("123", mockGuild);

    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.BAN,
      },
    ]);

    // Here: mock getGuildConfig to return null (simulate missing config)
    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? ({ id: "456", tag: "User#1234" } as User) : ({ id: "789" } as User),
    );

    await utils.checkPunishments(mockClient);

    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `Guild 123 not found in database`,
      discord: false,
    });
  });
  it("should log a warning if user is not banned in guild", async () => {
    const mockClient = createMockClient();

    const mockGuild = {
      id: "123",
      name: "Test Guild",
      members: {
        fetch: vi.fn(),
        unban: vi.fn(),
      },
      bans: {
        cache: new Map(),
      },
      roles: {
        cache: new Map(),
      },
    } as unknown as Guild;

    const mockUser = { id: "456", tag: "User#1234" } as User;
    const mockStaff = { id: "789" } as User;

    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.BAN,
      },
    ]);
    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ language: "en" });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? mockUser : mockStaff,
    );
    mockClient.guilds.cache.set("123", mockGuild);

    await utils.checkPunishments(mockClient);
    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `User ${mockUser.tag} is not banned in guild ${mockGuild.name}`,
      discord: false,
    });
  });
  it("should log a warning if member not found for mute punishment", async () => {
    const mockClient = createMockClient();

    const mockGuild = {
      id: "123",
      name: "Test Guild",
      members: {
        fetch: vi.fn(),
        cache: new Map(),
      },
      bans: {
        cache: new Map(),
      },
      roles: {
        cache: new Map([["muteRole", { id: "muteRole" }]]),
      },
    } as unknown as Guild;

    const mockUser = { id: "456", tag: "User#1234" } as User;
    const mockStaff = { id: "789" } as User;

    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.MUTE,
      },
    ]);
    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ language: "en" });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? mockUser : mockStaff,
    );
    mockClient.guilds.cache.set("123", mockGuild);

    await utils.checkPunishments(mockClient);
    expect(logger.log).toHaveBeenCalledWith({
      level: "warn",
      message: `Member ${mockUser.tag} not found in guild ${mockGuild.name}`,
      discord: false,
    });
  });
  it("should give back previous roles to a muted user", async () => {
    const mockClient = createMockClient();
    const mockGuild = {
      id: "123",
      name: "Test Guild",
      members: {
        fetch: vi.fn(),
        cache: new Map(),
      },
      bans: {
        cache: new Map(),
      },
      roles: {
        cache: new Map([
          ["muteRole", { id: "muteRole" }],
          ["role1", { id: "role1" }],
        ]),
      },
    } as unknown as Guild;

    const mockMember = {
      roles: {
        cache: new Map([["role1", { id: "role1" }]]),
        add: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      guild: mockGuild,
    } as unknown as GuildMember;

    mockGuild.members.fetch = vi.fn().mockResolvedValue(mockMember);
    mockGuild.members.cache.set("456", mockMember);

    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.MUTE,
        previous_roles: ["role1"], // Important here
      },
    ]);
    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      language: "en",
      mute_role_id: "muteRole",
    });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? ({ id: "456", tag: "User#1234" } as User) : ({ id: "789" } as User),
    );
    mockClient.guilds.cache.set("123", mockGuild);

    await utils.checkPunishments(mockClient);

    expect(mockMember.roles.add).toHaveBeenCalledWith(expect.arrayContaining(["role1"])); // to add previous roles
    expect(mockMember.roles.remove).toHaveBeenCalled(); // to remove muteRole
  });
  it("should remove roles from previous_roles if role not found in guild roles cache", async () => {
    const mockClient = createMockClient();

    const mockGuild = {
      id: "123",
      name: "Test Guild",
      members: {
        fetch: vi.fn(),
        cache: new Map([
          [
            "456",
            {
              roles: {
                cache: new Map([["role1", { id: "role1" }]]),
                add: vi.fn(),
                remove: vi.fn(),
              },
              guild: {} as Guild,
            },
          ],
        ]),
      },
      bans: { cache: new Map() },
      roles: {
        // Only "role1" exists in cache, "missingRole" does not
        cache: new Map([["role1", { id: "role1" }]]),
      },
    } as unknown as Guild;
    const mockMember = {
      roles: {
        cache: new Map([["role1", { id: "role1" }]]),
        add: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      guild: mockGuild,
    } as unknown as GuildMember;
    const mockUser = { id: "456", tag: "User#1234" } as User;
    const mockStaff = { id: "789" } as User;
    const mockedExpiredPunishments = [
      {
        guild_id: "123",
        user_id: "456",
        staff_id: "789",
        expires_at: dayjs().subtract(1, "hour").toISOString(),
        created_at: dayjs().subtract(2, "hour").toISOString(),
        type: PunishmentType.MUTE,
        previous_roles: ["role1", "missingRole"],
      },
    ];

    // Mock the database call to return the *same* array object
    (getExpiredPunishments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockedExpiredPunishments);

    (getGuildConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ language: "en" });
    (mockClient.users.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((id) =>
      id === "456" ? mockUser : mockStaff,
    );
    mockClient.guilds.cache.set("123", mockGuild);
    mockGuild.members.cache.set("456", mockMember);
    await utils.checkPunishments(mockClient);

    // After checkPunishments, "missingRole" should be removed from previous_roles
    expect(mockedExpiredPunishments[0].previous_roles).toEqual(["role1"]);
  });
});
