import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "../config/server";
import { DEFAULT_MODELS, OPENAI_BASE_URL } from "../constant";
import { collectModelTable } from "../utils/model";
import { makeAzurePath } from "../azure";
import connectDB from "./mongodb";

const serverConfig = getServerSideConfig();

export async function requestOpenai(
  req: NextRequest,
  loginMode = false,
  accessCode = "",
  bodyClone: any,
) {
  const controller = new AbortController();
  const authValue = req.headers.get("Authorization") ?? "";
  const authHeaderName = serverConfig.isAzure ? "api-key" : "Authorization";

  let path = `${req.nextUrl.pathname}${req.nextUrl.search}`.replaceAll(
    "/api/openai/",
    "",
  );

  let baseUrl =
    serverConfig.azureUrl || serverConfig.baseUrl || OPENAI_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Proxy] ", path);
  console.log("[Base Url]", baseUrl);
  // this fix [Org ID] undefined in server side if not using custom point
  if (serverConfig.openaiOrgId !== undefined) {
    console.log("[Org ID]", serverConfig.openaiOrgId);
  }

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  if (serverConfig.isAzure) {
    if (!serverConfig.azureApiVersion) {
      return NextResponse.json({
        error: true,
        message: `missing AZURE_API_VERSION in server env vars`,
      });
    }
    path = makeAzurePath(path, serverConfig.azureApiVersion);
  }

  const fetchUrl = `${baseUrl}/${path}`;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
      ...(serverConfig.openaiOrgId && {
        "OpenAI-Organization": serverConfig.openaiOrgId,
      }),
    },
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // #1815 try to refuse gpt4 request
  if (serverConfig.customModels && req.body) {
    try {
      const modelTable = collectModelTable(
        DEFAULT_MODELS,
        serverConfig.customModels,
      );
      const clonedBody = await req.text();
      fetchOptions.body = clonedBody;
      const jsonBody = JSON.parse(clonedBody) as { model?: string };

      // not undefined and is false
      if (modelTable[jsonBody?.model ?? ""].available === false) {
        return NextResponse.json(
          {
            error: true,
            message: `you are not allowed to use ${jsonBody?.model} model`,
          },
          {
            status: 403,
          },
        );
      }
    } catch (e) {
      console.error("[OpenAI] gpt4 filter", e);
    }
  }

  try {
    if (loginMode) {
      const token = accessCode;
      const conn = (await connectDB()).connection;
      const user = await conn.collection("users").findOne({
        token: token,
      });
      if (!user) {
        return NextResponse.json(
          {
            error: true,
            msg: "token is invalid",
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
            msg: "token expired",
          },
          {
            status: 401,
          },
        );
      }
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
      console.log("[User Left] ", left);
      const modelName: string = bodyClone.model;
      console.log("[Model Name] ", modelName);
      const isGPT4 = modelName.includes("gpt-4");
      const base = isGPT4 ? gpt4_base * 30 : gpt3_base;
      if (left < base) {
        return NextResponse.json(
          {
            error: true,
            msg: "your balance is not enough",
          },
          {
            status: 402,
          },
        );
      }
      // update usage
      await conn.collection("wallets").insertOne({
        userId: user._id,
        amount: Math.round(base * 100) / 100,
        type: 2,
        description: `use ${modelName} to chat, cost ${base}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const res = await fetch(fetchUrl, fetchOptions);

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
