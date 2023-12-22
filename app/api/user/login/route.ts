import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth";
import connectDB from "@/app/api/mongodb";
import md5 from "spark-md5";

async function handle(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }
  try {
    const authResult = await auth(req);
    if (req.method === "GET") {
      return NextResponse.json(
        {
          valid: !authResult.error,
        },
        {
          status: 200,
        },
      );
    } else if (req.method === "POST") {
      // get username and password
      let { email, password, code } = await req.json();
      email = (email as string).toString();
      if (!email || !password || !code) {
        return NextResponse.json(
          {
            error: true,
            msg: "email, password or code is missing",
          },
          {
            status: 401,
          },
        );
      }
      // connect to database
      const conn = (await connectDB()).connection;
      // find user in database
      const user = await conn.collection("users").findOne({
        email: email,
      });
      const hashedPassword = md5.hash(password + process.env.SALT ?? "");
      const token = md5.hash(
        email + password + (process.env.SALT ?? "") + Date.now(),
      );
      if (!user) {
        // search code in database
        const accessCode = await conn.collection("codes").findOne({
          code: code,
          email: email,
          deleted: false,
        });
        if (!accessCode) {
          return NextResponse.json(
            {
              error: true,
              msg: "code is invalid",
            },
            {
              status: 401,
            },
          );
        }
        // update code
        await conn.collection("codes").updateMany(
          {
            code: code,
          },
          {
            $set: {
              deleted: true,
            },
          },
        );
        const newUser = {
          email: email,
          password: hashedPassword,
          disabled: false,
          gpt3_base: 0.95,
          gpt4_base: 1,
          type: "user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          token: token,
          lastSigninAt: new Date().toISOString(),
        };
        const user = await conn.collection("users").insertOne(newUser);
        await conn.collection("wallets").insertOne({
          userId: user.insertedId,
          amount: 20,
          type: 1,
          description: "register bonus",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const returnUser = {
          id: user.insertedId,
          email: email,
          type: "user",
          gpt3_base: 0.95,
          gpt4_base: 1,
        };
        return NextResponse.json(
          {
            error: false,
            msg: "login successfully",
            token: token,
            user: returnUser,
          },
          {
            status: 200,
          },
        );
      } else {
        if (user.password === hashedPassword) {
          if (user.disabled) {
            return NextResponse.json(
              {
                error: true,
                msg: "user is disabled",
              },
              {
                status: 401,
              },
            );
          } else {
            // search code in database
            const accessCode = await conn.collection("codes").findOne({
              code: code,
              email: email,
              deleted: false,
            });
            if (!accessCode) {
              return NextResponse.json(
                {
                  error: true,
                  msg: "code is invalid",
                },
                {
                  status: 401,
                },
              );
            }
            // update code
            await conn.collection("codes").updateMany(
              {
                code: code,
              },
              {
                $set: {
                  deleted: true,
                },
              },
            );
            await conn.collection("users").updateOne(
              {
                email: email,
              },
              {
                $set: {
                  lastSigninAt: new Date().toISOString(),
                  token: token,
                },
              },
            );
            return NextResponse.json(
              {
                error: false,
                msg: "login successfully",
                token: token,
                user: {
                  id: user._id,
                  email: email,
                  type: user.type,
                  gpt3_base: user.gpt3_base,
                  gpt4_base: user.gpt4_base,
                },
              },
              {
                status: 200,
              },
            );
          }
        } else {
          return NextResponse.json(
            {
              error: true,
              msg: "password is wrong",
            },
            {
              status: 401,
            },
          );
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
