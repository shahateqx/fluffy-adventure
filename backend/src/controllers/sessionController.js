import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";

export async function createSession(req, res) {
    try {
        const { problem, difficulty } = req.body;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;

        if (!problem || !difficulty) {
            return res.status(400).json({ message: "Problem and difficulty are required" });
        }

        const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const session = await Session.create({ problem, difficulty, host: userId, callId });

        await Promise.all([
            streamClient.video.call("default", callId).getOrCreate({
                data: {
                    created_by_id: clerkId,
                    members: [{ user_id: clerkId, role: "host" }],
                    custom: { problem, difficulty, sessionId: session._id.toString() },
                },
            }),
            chatClient.channel("messaging", callId, { name: `${problem} Session`, created_by_id: clerkId, members: [clerkId] }).create(),
        ]);

        res.status(201).json({ session });
    } catch (error) {
        console.error("createSession error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getActiveSessions(_, res) {
    try {
        const sessions = await Session.find({ status: "active" })
            .populate("host participant", "name profileImage email clerkId")
            .sort({ createdAt: -1 }).limit(20);
        res.status(200).json({ sessions });
    } catch (error) {
        console.error("getActiveSessions error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getMyRecentSessions(req, res) {
    try {
        const sessions = await Session.find({
            status: "completed",
            $or: [{ host: req.user._id }, { participant: req.user._id }],
        }).sort({ createdAt: -1 }).limit(20);
        res.status(200).json({ sessions });
    } catch (error) {
        console.error("getMyRecentSessions error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getSessionById(req, res) {
    try {
        const session = await Session.findById(req.params.id)
            .populate("host participant", "name email profileImage clerkId");
        if (!session) return res.status(404).json({ message: "Session not found" });
        res.status(200).json({ session });
    } catch (error) {
        console.error("getSessionById error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function joinSession(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const clerkId = req.user.clerkId;
        const session = await Session.findById(id);

        if (!session) return res.status(404).json({ message: "Session not found" });
        if (session.status !== "active") return res.status(400).json({ message: "Cannot join a completed session" });
        if (session.host.toString() === userId.toString()) return res.status(400).json({ message: "Host cannot join their own session as participant" });
        if (session.participant) return res.status(409).json({ message: "Session is full" });

        session.participant = userId;
        await session.save();
        await Promise.all([
            chatClient.channel("messaging", session.callId).addMembers([clerkId]),
            streamClient.video.call("default", session.callId).updateCallMembers({
                update_members: [{ user_id: clerkId, role: "call_member" }],
            }),
        ]);

        res.status(200).json({ session });
    } catch (error) {
        console.error("joinSession error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function endSession(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const session = await Session.findById(id);

        if (!session) return res.status(404).json({ message: "Session not found" });
        if (session.host.toString() !== userId.toString()) return res.status(403).json({ message: "Only the host can end the session" });
        if (session.status === "completed") return res.status(400).json({ message: "Session is already completed" });

        await Promise.all([
            streamClient.video.call("default", session.callId).delete({ hard: true }),
            chatClient.channel("messaging", session.callId).delete(),
        ]);

        session.status = "completed";
        await session.save();

        res.status(200).json({ session, message: "Session ended successfully" });
    } catch (error) {
        console.error("endSession error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}