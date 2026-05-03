import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import User from "../models/User.js";

export const inngest = new Inngest({ id: "talent-aq" });

const syncUser = inngest.createFunction(
  { id: "sync-user", triggers: { event: "clerk/user.created" } },
  async ({ event }) => {
    await connectDB();
    const { id, email_addresses, first_name, last_name, image_url } = event.data;
    const newUser = {
      clerkId: id,
      email: email_addresses[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`,
      profileImage: image_url,
    };
    await User.create(newUser);
  }
);

const deleteUserFromDB = inngest.createFunction(
  { id: "delete-user-from-db", triggers: { event: "clerk/user.deleted" } },
  async ({ event }) => {
    await connectDB();
    const { id } = event.data;
    await User.deleteOne({ clerkId: id });
  }
);

const updateUserInDB = inngest.createFunction(
  { id: "update-user-in-db", triggers: { event: "clerk/user.updated" } },
  async ({ event }) => {
    await connectDB();
    const { id, email_addresses, first_name, last_name, image_url } = event.data;
    const updatedUser = {
      email: email_addresses[0]?.email_address,
      name: `${first_name || ""} ${last_name || ""}`,
      profileImage: image_url,
    };
    await User.updateOne({ clerkId: id }, { $set: updatedUser });
  }
);

export const functions = [syncUser, deleteUserFromDB, updateUserInDB];