import { type NextRequest, NextResponse } from "next/server"
import { getGlobalScheduler } from "@/lib/sync/scheduler"
import type { PMSType } from "@/lib/pms/types"

export async function POST(request: NextRequest) {
  try {
    const { userId, pmsType } = await request.json()

    if (!userId || !pmsType) {
      return NextResponse.json({ error: "Missing userId or pmsType" }, { status: 400 })
    }

    const scheduler = getGlobalScheduler()
    const syncId = await scheduler.runManualSync(userId, pmsType as PMSType)

    return NextResponse.json({
      success: true,
      syncId,
      message: "Manual sync started successfully",
    })
  } catch (error) {
    console.error("Manual sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
