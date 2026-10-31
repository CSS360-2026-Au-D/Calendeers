import fs from "node:fs";
import path from "node:path"
import {
    randomBytes,
    createCipheriv,
    createDecipheriv,
} from "node:crypto";

const FILE = path.resolve("data/calendar-links.json");
const SCHEDULE_FILE = path.resolve("data/class-schedules.json");
const COMPLETED_FILE = path.resolve("data/completed-assignments.json");

function getKey() {
    const hex = process.env.CALENDAR_ENCRYPTION_KEY || "";

    if (!/^[a-f0-9]{64}$/i.test(hex)) {
        throw new Error("Invalid CALENDAR_ENCRYPTION_KEY");
    }
    return Buffer.from(hex, "hex");
}

function readDatabase(file) {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveDatabase(file, data) {
    fs.mkdirSync(path.dirname(file), {
        recursive: true,
        mode: 0o700
    });

    fs.writeFileSync(
        `${file}.tmp`,
        JSON.stringify(data),
        { mode: 0o600 }
    );

    fs.renameSync(`${file}.tmp`, file);
}

function encrypt(value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final()
    ]);

    return {
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
        value: encrypted.toString("hex")
    };
}

function decrypt(record) {
    const decipher = createDecipheriv(
        "aes-256-gcm",
        getKey(),
        Buffer.from(record.iv, "hex")
    );

    decipher.setAuthTag(Buffer.from(record.tag, "hex"));

    return Buffer.concat([
        decipher.update(Buffer.from(record.value, "hex")),
        decipher.final()
    ]).toString("utf8");
}

export function saveCalendar(userId, url) {
    const database = readDatabase(FILE);
    database[userId] = encrypt(url);
    saveDatabase(FILE, database);
}

export function getCalendar(userId) {
    const record = readDatabase(FILE)[userId];
    return record ? decrypt(record) : null;
}

export function removeCalendar(userId) {
    return removeRecord(FILE, userId);
}

export function saveSchedule(userId, schedule) {
    const database = readDatabase(SCHEDULE_FILE);
    database[userId] = encrypt(JSON.stringify(schedule));
    saveDatabase(SCHEDULE_FILE, database);
}

export function getSchedule(userId) {
    const record = readDatabase(SCHEDULE_FILE)[userId];
    return record ? JSON.parse(decrypt(record)) : null;
}

export function removeSchedule(userId) {
    return removeRecord(SCHEDULE_FILE, userId);
}

// Canvas assignment UIDs the user has marked done; not sensitive, so stored as-is.
export function getCompletedAssignments(userId) {
    return readDatabase(COMPLETED_FILE)[userId] || [];
}

export function markAssignmentsCompleted(userId, assignmentIds) {
    const database = readDatabase(COMPLETED_FILE);
    const completed = new Set(database[userId] || []);

    for (const id of assignmentIds) completed.add(id);

    database[userId] = [...completed];
    saveDatabase(COMPLETED_FILE, database);
}

export function removeCompletedAssignments(userId) {
    return removeRecord(COMPLETED_FILE, userId);
}

function removeRecord(file, userId) {
    const database = readDatabase(file);
    const existed = Object.hasOwn(database, userId);

    if (existed) {
        delete database[userId];
        saveDatabase(file, database);
    }

    return existed;
}
