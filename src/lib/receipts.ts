// Receipt objects live at {user_id}/{uuid}.jpg in the private receipts bucket (TECH_SPEC §4.3).
// Actions check every path they are handed against the signed-in user before touching Storage
// or saving it on a row, so a client can't point at another user's file.

export const RECEIPTS_BUCKET = "receipts";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RECEIPT_PATH = new RegExp(`^(${UUID})/${UUID}\\.jpg$`);

/** Whether `path` is a receipt object in `userId`'s own folder. */
export function isOwnReceiptPath(path: unknown, userId: string): path is string {
  if (typeof path !== "string") return false;
  const match = RECEIPT_PATH.exec(path);
  return match !== null && match[1] === userId.toLowerCase();
}

export function newReceiptPath(userId: string, id: string = crypto.randomUUID()): string {
  return `${userId}/${id}.jpg`;
}
