import { google } from "googleapis";
import { getAuthClient } from "../routes/auth.js";

export async function getCalendarClient() {
  const auth = getAuthClient();
  return google.calendar({ version: "v3", auth });
}

export async function getGmailClient() {
  const auth = getAuthClient();
  return google.gmail({ version: "v1", auth });
}
