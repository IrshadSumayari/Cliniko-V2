import { type NextRequest, NextResponse } from "next/server";
import { getGlobalScheduler } from "@/lib/sync/scheduler";
import type { PMSType } from "@/lib/pms/types";

export async function POST(request: NextRequest) {
  try {
    const { userId, pmsType, action } = await request.json();

    if (!userId || !pmsType || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const scheduler = getGlobalScheduler();

    switch (action) {
      case "pause":
        await scheduler.pauseUserSync(userId, pmsType as PMSType);
        return NextResponse.json({ success: true, message: "Sync paused" });

      case "resume":
        await scheduler.resumeUserSync(userId, pmsType as PMSType);
        return NextResponse.json({ success: true, message: "Sync resumed" });

      case "force_full":
        const syncId = await scheduler.forceFullSync(
          userId,
          pmsType as PMSType
        );
        return NextResponse.json({
          success: true,
          syncId,
          message: "Full sync started",
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Sync control error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
