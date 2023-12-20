import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/api/mongodb";
import { sendVerificationEmail } from "@/app/api/smtp";

async function handle(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }
  try {
    // get db
    const conn = (await connectDB()).connection;
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(
        {
          error: true,
          msg: "email is missing",
        },
        {
          status: 401,
        },
      );
    }
    const code = Math.floor(Math.random() * 1000000);
    const now = Date.now();
    const lastCode = await conn.collection("codes").findOne({
      email: email,
      deleted: false,
    });
    if (lastCode && now - new Date(lastCode.createAt).getTime() < 60000) {
      return NextResponse.json(
        {
          error: true,
          msg: "send code too frequently",
        },
        {
          status: 401,
        },
      );
    }
    // update all codes is deleted
    await conn.collection("codes").updateMany(
      {
        email: email,
      },
      {
        $set: {
          deleted: true,
        },
      },
    );
    // send code
    await sendVerificationEmail(email, code);
    // save code to database
    await conn.collection("codes").insertOne({
      email: email,
      code: code,
      createAt: new Date().toISOString(),
      deleted: false,
    });
    // set timeout to delete code, after 5 minutes
    setTimeout(async () => {
      await conn.collection("codes").updateOne(
        {
          email: email,
          code: code,
        },
        {
          $set: {
            deleted: true,
          },
        },
      );
    }, 300000);
    // return
    return NextResponse.json(
      {
        error: false,
        msg: "code sent",
      },
      {
        status: 200,
      },
    );
  } catch (e) {
    console.error(e);
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
