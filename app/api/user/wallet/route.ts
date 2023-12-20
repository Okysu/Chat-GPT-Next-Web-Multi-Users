import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth";
import connectDB from "@/app/api/mongodb";

async function handle(req: NextRequest) {
  const authResult = await auth(req);
  if (authResult.error) {
    return NextResponse.json(
      {
        error: true,
        message: authResult.msg,
      },
      {
        status: 401,
      },
    );
  }
  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }
  try {
    const conn = (await connectDB()).connection;
    const user = await conn.collection("users").findOne({
      token: authResult.accessCode,
    });
    if (!user) {
      return NextResponse.json(
        {
          error: true,
          message: "token is invalid",
        },
        {
          status: 401,
        },
      );
    }
    const now = Date.now();
    const lastSigninAt = new Date(user.lastSigninAt).getTime();
    if (now - lastSigninAt > 1000 * 60 * 60 * 24 * 30) {
      return NextResponse.json(
        {
          error: true,
          message: "token expired",
        },
        {
          status: 401,
        },
      );
    }
    if (req.method === "GET") {
      const { gpt3_base, gpt4_base } = user;
      // get the user all wallets
      const wallets = await conn
        .collection("wallets")
        .find({
          userId: user._id,
        })
        .toArray();
      let left = 0;
      wallets.forEach((wallet) => {
        if (wallet.type === 1) {
          left += wallet.amount;
        } else if (wallet.type === 2) {
          left -= wallet.amount;
        }
      });
      left = Math.round(left * 100) / 100;
      return NextResponse.json(
        {
          gpt3_base,
          gpt4_base,
          left,
          list: wallets.slice(0, 10).map((wallet) => {
            return {
              type: wallet.type,
              amount: Math.round(wallet.amount * 100) / 100,
              description: wallet.description,
              createdAt: wallet.createdAt,
            };
          }),
        },
        {
          status: 200,
        },
      );
    } else if (req.method === "POST") {
      const { code } = await req.json();
      if (!code) {
        return NextResponse.json(
          {
            error: true,
            message: "code is missing",
          },
          {
            status: 401,
          },
        );
      }
      const redeemCode = await conn.collection("redeemCodes").findOne({
        code: code,
        isUsed: false,
      });
      if (!redeemCode) {
        return NextResponse.json(
          {
            error: true,
            message: "code is invalid",
          },
          {
            status: 401,
          },
        );
      }
      // update code used
      await conn.collection("redeemCodes").updateOne(
        {
          _id: redeemCode._id,
          code: code,
        },
        {
          $set: {
            isUsed: true,
            userId: user._id,
          },
        },
      );
      // update user wallet
      await conn.collection("wallets").insertOne({
        userId: user._id,
        type: 1,
        amount: redeemCode.amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json(
        {
          error: false,
          message: "redeem successfully",
        },
        {
          status: 200,
        },
      );
    }
  } catch (e) {
    console.error(e);
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
