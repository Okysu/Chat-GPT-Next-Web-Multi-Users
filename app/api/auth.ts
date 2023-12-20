import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX } from "../constant";
import connectDB from "./mongodb";

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

function parseApiKey(bearToken: string) {
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();
  const isOpenAiKey = !token.startsWith(ACCESS_CODE_PREFIX);
  return {
    accessCode: isOpenAiKey ? token : token.slice(ACCESS_CODE_PREFIX.length),
    apiKey: isOpenAiKey ? token : "",
    loginMode: token.length > 0 && !token.startsWith(ACCESS_CODE_PREFIX),
  };
}

export async function auth(req: NextRequest) {
  const authToken = req.headers.get("Authorization") ?? "";

  // check if it is openai api key or user token
  const { accessCode, apiKey, loginMode } = parseApiKey(authToken);
  console.log("[Auth] loginMode:", loginMode);

  const hashedCode = md5.hash(accessCode ?? "").trim();

  const serverConfig = getServerSideConfig();
  console.log("[Auth] allowed hashed codes: ", [...serverConfig.codes]);
  console.log("[Auth] got access code:", accessCode);
  console.log("[Auth] hashed access code:", hashedCode);
  console.log("[User IP] ", getIP(req));
  console.log("[Time] ", new Date().toLocaleString());
  if (
    serverConfig.needCode &&
    !serverConfig.codes.has(hashedCode) &&
    !apiKey &&
    !loginMode
  ) {
    return {
      error: true,
      msg: !accessCode ? "empty access code" : "wrong access code",
    };
  }

  if (serverConfig.hideUserApiKey && !!apiKey && !loginMode) {
    return {
      error: true,
      msg: "you are not allowed to access openai with your own api key",
    };
  }

  // if user does not provide an api key, inject system api key
  if (!apiKey) {
    const serverApiKey = serverConfig.isAzure
      ? serverConfig.azureApiKey
      : serverConfig.apiKey;

    if (serverApiKey) {
      console.log("[Auth] use system api key");
      req.headers.set(
        "Authorization",
        `${serverConfig.isAzure ? "" : "Bearer "}${serverApiKey}`,
      );
    } else {
      console.log("[Auth] admin did not provide an api key");
    }
  } else {
    if (loginMode) {
      console.log("[Auth] use is logged in");

      // connect to database
      const conn = (await connectDB()).connection;
      const user = await conn.collection("users").findOne({
        token: accessCode,
      });
      if (!user) {
        return {
          error: true,
          msg: "invalid token",
        };
      }
      // check token expired
      const now = Date.now();
      const lastSigninAt = new Date(user.lastSigninAt).getTime();
      if (now - lastSigninAt > 1000 * 60 * 60 * 24 * 30) {
        return {
          error: true,
          msg: "token expired",
        };
      }
      const serverApiKey = serverConfig.isAzure
        ? serverConfig.azureApiKey
        : serverConfig.apiKey;

      if (serverApiKey) {
        console.log("[Auth] use system api key");
        req.headers.set(
          "Authorization",
          `${serverConfig.isAzure ? "" : "Bearer "}${serverApiKey}`,
        );
      } else {
        console.log("[Auth] admin did not provide an api key");
      }
    } else {
      console.log("[Auth] use user api key");
    }
  }

  return {
    error: false,
    loginMode,
    accessCode,
  };
}
