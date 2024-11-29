import {Events} from "discord.js";
import {EventBase} from "../../@types/types";

export default {
    name: Events.ClientReady,
    once: true,
    async execute() {
        console.log("Client ready");
    }
} as EventBase