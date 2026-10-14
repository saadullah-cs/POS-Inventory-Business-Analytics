import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Readable } from "stream"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY
    const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || "").replace(/^["']|["']$/g, "").trim()

    // 1. Validate Service Account credentials and Folder ID in environment
    if (!clientEmail || !privateKeyRaw) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Google Service Account credentials. Ensure GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are set.",
        },
        { status: 500 }
      )
    }

    if (!process.env.GOOGLE_DRIVE_FOLDER_ID || folderId.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Google Drive Folder ID. Ensure GOOGLE_DRIVE_FOLDER_ID is set in environment variables.",
        },
        { status: 500 }
      )
    }

    // 2. Parse and validate incoming database state payload
    let payload: any
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload: Expected valid JSON body.",
        },
        { status: 400 }
      )
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload: Expected database state object (Invoices, Clients, Products, Settings).",
        },
        { status: 400 }
      )
    }

    // 3. Format timestamp and determine file name (e.g., biocure-backup-YYYY-MM-DD.json)
    const now = new Date()
    const dateStr = now.toISOString().split("T")[0] // YYYY-MM-DD
    const fileName =
      typeof payload.fileName === "string" && payload.fileName.trim().length > 0
        ? payload.fileName.trim()
        : `biocure-backup-${dateStr}.json`

    // 4. Wrap database state with standardized backup metadata
    const backupData = {
      metadata: {
        appName: "Biocure Health Care POS & Inventory",
        backupTimestamp: now.toISOString(),
        version: "1.0.0",
        summary: {
          invoicesCount: Array.isArray(payload.invoices || payload.Invoices)
            ? (payload.invoices || payload.Invoices).length
            : 0,
          clientsCount: Array.isArray(payload.clients || payload.Clients)
            ? (payload.clients || payload.Clients).length
            : 0,
          productsCount: Array.isArray(payload.products || payload.Products)
            ? (payload.products || payload.Products).length
            : 0,
          hasSettings: Boolean(payload.settings || payload.Settings),
        },
      },
      ...payload,
    }

    // 5. Convert JSON payload into an in-memory buffer
    const jsonString = JSON.stringify(backupData, null, 2)
    const buffer = Buffer.from(jsonString, "utf-8")

    // 6. Handle escaped newlines in private key string
    const formattedPrivateKey = privateKeyRaw.replace(/\\n/g, "\n")

    // 7. Initialize Google Drive Service Account authentication
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedPrivateKey,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
      ],
    })

    const drive = google.drive({ version: "v3", auth })

    // 8. Prepare upload parameters targeting specified Google Drive Folder ID
    // Explicitly define parents array inside requestBody using folder ID from environment variables
    const requestBody = {
      name: fileName,
      mimeType: "application/json",
      parents: [folderId || (process.env.GOOGLE_DRIVE_FOLDER_ID as string)],
    }

    const media = {
      mimeType: "application/json",
      body: Readable.from(buffer),
    }

    // 9. Upload buffer directly to Google Drive inside the shared folder
    const response = await drive.files.create({
      requestBody,
      media,
      supportsAllDrives: true,
      fields: "id, name, mimeType, webViewLink, webContentLink, createdTime, size",
    })

    const file = response.data

    return NextResponse.json(
      {
        success: true,
        message: "Database backup uploaded to Google Drive successfully",
        fileId: file.id,
        fileName: file.name,
        webViewLink: file.webViewLink || null,
        createdTime: file.createdTime || now.toISOString(),
        sizeBytes: buffer.length,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Google Drive Backup Upload Error:", error)

    const errorMessage =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Internal Server Error during Google Drive upload"

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error?.response?.data || error?.errors || null,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  const isConfigured = Boolean(
    process.env.GOOGLE_CLIENT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  )

  return NextResponse.json({
    status: isConfigured ? "configured" : "unconfigured",
    hasFolderId: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL || null,
  })
}
