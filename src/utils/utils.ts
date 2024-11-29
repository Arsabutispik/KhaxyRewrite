const consoleColors = {
    SUCCESS: "\u001b[32m",
    WARNING: "\u001b[33m",
    ERROR: "\u001b[31m",
    INFO: "\u001b[36m",
};
function log(type: "SUCCESS" | "ERROR" | "WARNING" | "INFO", path: string, text: string) {
    console.log(
        `\u001b[36;1m<bot-prefab>\u001b[0m\u001b[34m [${path}]\u001b[0m - ${consoleColors[type]}${text}\u001b[0m`,
    );
}
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export {log, sleep}