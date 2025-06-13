# Khaxy

Khaxy is a modern rewrite of the [Khaxy_Legacy](https://github.com/Arsabutispik/Khaxy_Legacy) Discord bot, introducing SQL database support, internationalization (i18n), and improved customization. Built with TypeScript and Discord.js v14, it offers advanced moderation, music playback, and utility features for Discord servers.

## Features
- **Advanced Moderation:** Automated punishments, infraction tracking, modmail, and more.
- **Music Playback:** Supports YouTube and SoundCloud via [discord-player](https://discord-player.js.org/).
- **Internationalization (i18n):** Multi-language support using i18next.
- **Customizable:** Easily configure features and behaviors per guild.
- **Scheduled Tasks:** Automated tasks using cron jobs (e.g., color of the day, thread expiration).
- **SQL Database:** Uses Prisma ORM for scalable and reliable data storage.


## Prerequisites
- **Node.js** (LTS version recommended): [Download and install Node.js](https://nodejs.org/)
- **pnpm** (recommended) or npm:
  - Install pnpm globally: `npm install -g pnpm`
- **Git:** [Download and install Git](https://git-scm.com/)
- **PostgreSQL database:** [Download and install PostgreSQL](https://www.postgresql.org/download/)

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/Arsabutispik/Khaxy.git
   cd Khaxy
   ```
2. **Install dependencies:**
   ```sh
   npm install
   # or
   pnpm install
   ```
3. **Set up environment variables:**
   - Copy `.env.example` to `.env` and fill in the required values (e.g., Discord bot token, database URL).

4. **Set up the database:**
   ```sh
   npx prisma migrate deploy
   ```

5. **Build the project:**
   ```sh
   npm run build
   ```

6. **Start the bot:**
   ```sh
   npm start
   # or for development
   npm run dev
   ```

## Usage
- Invite the bot to your server using the OAuth2 URL with the required permissions.
- Use slash commands to interact with the bot (e.g., `/play`, `/ban`, `/modmail`).
- Configure guild-specific settings using provided commands or configuration files.

## Configuration
- All configuration is managed via environment variables and the `src/lib/Config.ts` file.
- Translation files are located in `src/locales/`.
- Prisma schema and migrations are in the `prisma/` directory.

## Contributing
Contributions are welcome! Please open issues or pull requests for new features, bug fixes, or improvements.

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your fork and open a pull request

## License
This project is licensed under the MIT License.
